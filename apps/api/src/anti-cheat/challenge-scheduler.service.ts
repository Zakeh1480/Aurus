import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { getAntiCheatConfig } from './anti-cheat.constants';
import { NonceService } from './nonce.service';
import { TrustScoreService } from './trust-score.service';

/** ZSET compartilhado entre réplicas — score = próximo instante (epoch ms) em que o desafio daquele jogador deve disparar. */
const DUE_ZSET_KEY = 'ac:challenge-schedule:due';

/** Teto por chamada de ZRANGEBYSCORE — pollDueChallenges drena em loop até vir menos que isso. */
const POLL_BATCH_SIZE = 50;

function scheduleKey(matchId: string, userId: string): string {
  return `ac:match:${matchId}:user:${userId}:challenge-schedule`;
}

/** matchId/userId são UUIDs (nunca contêm ":"), então splitar no primeiro ":" é seguro e reversível. */
function scheduleMember(matchId: string, userId: string): string {
  return `${matchId}:${userId}`;
}

function splitMember(member: string): [matchId: string, userId: string] {
  const [matchId, userId] = member.split(':') as [string, string];
  return [matchId, userId];
}

/**
 * Cria o HASH de agendamento (targetCount/issuedSoFar/sessionStartedAt) só
 * se ainda não existir — EXISTS + HSET + ZADD precisam ficar atômicos pra
 * não deixar HASH e ZSET dessincronizados se dois replicas tentarem criar o
 * mesmo (matchId,userId) ao mesmo tempo (ex.: os dois jogadores chamando
 * POST /matches/:id/anti-cheat-secret quase simultaneamente em réplicas
 * diferentes — cada chamada agenda para OS DOIS jogadores, então essa
 * corrida é real).
 */
const CREATE_SCHEDULE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return 0
end
redis.call('HSET', KEYS[1], 'targetCount', ARGV[1], 'issuedSoFar', '0', 'sessionStartedAt', ARGV[2])
redis.call('ZADD', KEYS[2], ARGV[4], ARGV[3])
return 1
`;

/**
 * Reivindica um ciclo de desafio vencido: só quem vê o score do ZSET ainda
 * <= now consegue prosseguir (mesmo compare-and-swap do ScoreTickScheduler)
 * — o ZREM acontece dentro do mesmo script atômico que lê/incrementa
 * issuedSoFar, então a janela entre "achei que estava vencido" e
 * "reivindiquei" nunca deixa dois pollers incrementarem o mesmo contador
 * pro mesmo ciclo. Reagendar o PRÓXIMO ciclo (delay aleatório, teto de
 * maxSessionMs) fica em JS, fora do script — só quem já reivindicou chega
 * lá, então não há mais corrida a essa altura.
 */
const CLAIM_AND_ADVANCE_SCRIPT = `
local score = redis.call('ZSCORE', KEYS[2], ARGV[1])
if score == false then
  return {0}
end
if tonumber(score) > tonumber(ARGV[2]) then
  return {0}
end
redis.call('ZREM', KEYS[2], ARGV[1])
local issuedSoFar = tonumber(redis.call('HGET', KEYS[1], 'issuedSoFar'))
local targetCount = tonumber(redis.call('HGET', KEYS[1], 'targetCount'))
local sessionStartedAt = redis.call('HGET', KEYS[1], 'sessionStartedAt')
local newIssuedSoFar = issuedSoFar + 1
if newIssuedSoFar >= targetCount then
  redis.call('DEL', KEYS[1])
  return {1, sessionStartedAt, 1}
end
redis.call('HSET', KEYS[1], 'issuedSoFar', newIssuedSoFar)
return {1, sessionStartedAt, 0}
`;

/**
 * Agenda 2-4 desafios (`match:verify-challenge`) POR JOGADOR, em intervalos
 * aleatórios, parando quando atinge a contagem-alvo ou o teto de segurança
 * `maxSessionMs`. Não há campo de "duração da partida" hoje — então o
 * agendamento é por contagem-alvo + intervalo repetido, não por fração de
 * uma duração conhecida.
 *
 * Estado mora em Redis (Prompt 22), não em memória — mesma classe de
 * correção dos Prompts 19-21. Sub-estado por jogador (issuedSoFar/
 * targetCount/sessionStartedAt) é mutável e precisa ser lido+incrementado
 * atomicamente, então — ao contrário do encerramento por duração (Prompt
 * 20) — precisa mesmo de script Lua (mesmo raciocínio de
 * PendingMatchService, Prompt 19).
 */
@Injectable()
export class ChallengeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChallengeSchedulerService.name);
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly nonceService: NonceService,
    private readonly trustScoreService: TrustScoreService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      this.pollDueChallenges().catch((error: unknown) => {
        this.logger.error('Falha ao varrer desafios de anti-cheat vencidos', error);
      });
    }, getAntiCheatConfig().challengePollIntervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.pollTimer);
  }

  /**
   * Idempotente — chamado a cada POST /matches/:id/anti-cheat-secret (até
   * 2x por partida, uma por jogador, sempre agendando para os dois
   * jogadores). Se o primeiro delay sorteado já estourar maxSessionMs,
   * nada é agendado — igual ao comportamento original — mas, diferente do
   * Set em memória de antes, nada fica registrado no Redis pra lembrar
   * dessa tentativa bloqueada: uma chamada seguinte pode sortear um delay
   * menor e ter sucesso. É uma diferença aceita, não uma regressão: com os
   * defaults (intervalo até 180s, teto de sessão de 1800s) esse cenário
   * exige uma configuração incomum pra sequer ser alcançável.
   */
  ensureScheduledForMatch(matchId: string, player1Id: string, player2Id: string): void {
    for (const userId of [player1Id, player2Id]) {
      this.createSchedule(matchId, userId).catch((error: unknown) => {
        this.logger.error(`Falha ao agendar desafios para match ${matchId}, user ${userId}`, error);
      });
    }
  }

  private async createSchedule(matchId: string, userId: string): Promise<void> {
    const config = getAntiCheatConfig();
    const targetCount =
      config.challengesMin +
      Math.floor(Math.random() * (config.challengesMax - config.challengesMin + 1));
    const sessionStartedAt = Date.now();
    const delay =
      config.challengeIntervalMinMs +
      Math.random() * (config.challengeIntervalMaxMs - config.challengeIntervalMinMs);
    if (delay > config.maxSessionMs) return;

    await this.redis.eval(
      CREATE_SCHEDULE_SCRIPT,
      2,
      scheduleKey(matchId, userId),
      DUE_ZSET_KEY,
      targetCount,
      sessionStartedAt,
      scheduleMember(matchId, userId),
      sessionStartedAt + delay,
    );
  }

  /**
   * Varre o ZSET cross-instance achando ciclos de desafio vencidos.
   * Chamado periodicamente pelo poller de onModuleInit, mas exposto como
   * método público porque testes chamam direto, sem depender de timers
   * reais.
   */
  async pollDueChallenges(): Promise<void> {
    const now = Date.now();
    for (;;) {
      const dueMembers = await this.redis.zrangebyscore(
        DUE_ZSET_KEY,
        '-inf',
        now,
        'LIMIT',
        0,
        POLL_BATCH_SIZE,
      );
      for (const member of dueMembers) {
        await this.claimAndFire(member, now).catch((error: unknown) => {
          this.logger.error(`Falha ao processar desafio vencido (${member})`, error);
        });
      }
      if (dueMembers.length < POLL_BATCH_SIZE) return;
    }
  }

  private async claimAndFire(member: string, now: number): Promise<void> {
    const [matchId, userId] = splitMember(member);
    const result = (await this.redis.eval(
      CLAIM_AND_ADVANCE_SCRIPT,
      2,
      scheduleKey(matchId, userId),
      DUE_ZSET_KEY,
      member,
      now,
    )) as [number, string?, number?];
    if (result[0] !== 1) return;

    const sessionStartedAt = Number(result[1]);
    const isLast = result[2] === 1;

    // fireChallenge e o reagendamento do próximo ciclo são independentes —
    // uma falha ao emitir o desafio atual não deve impedir o próximo de ser
    // agendado (mesmo comportamento desacoplado da versão em memória).
    await this.fireChallenge(matchId, userId).catch((error: unknown) => {
      this.logger.error(`Falha ao emitir desafio para match ${matchId}, user ${userId}`, error);
    });

    if (!isLast) {
      await this.scheduleNextFire(matchId, userId, sessionStartedAt).catch((error: unknown) => {
        this.logger.error(
          `Falha ao reagendar próximo desafio para match ${matchId}, user ${userId}`,
          error,
        );
      });
    }
  }

  private async scheduleNextFire(
    matchId: string,
    userId: string,
    sessionStartedAt: number,
  ): Promise<void> {
    const config = getAntiCheatConfig();
    const delay =
      config.challengeIntervalMinMs +
      Math.random() * (config.challengeIntervalMaxMs - config.challengeIntervalMinMs);
    const nextDueAtMs = Date.now() + delay;
    if (nextDueAtMs - sessionStartedAt > config.maxSessionMs) {
      await this.redis.del(scheduleKey(matchId, userId));
      return;
    }
    await this.redis.zadd(DUE_ZSET_KEY, nextDueAtMs, scheduleMember(matchId, userId));
  }

  private async fireChallenge(matchId: string, userId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status !== 'active') return; // partida encerrou — este ciclo em particular vira no-op

    const config = getAntiCheatConfig();
    const challengeId = randomUUID();
    const nonce = randomBytes(16).toString('base64url');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + config.challengeTtlMs);

    await this.nonceService.issueChallengeNonce(
      matchId,
      userId,
      challengeId,
      nonce,
      config.challengeTtlMs,
    );
    await this.trustScoreService.recordChallengeIssued(matchId, userId);

    this.matchmakingService.emitToUser(userId, 'match:verify-challenge', {
      matchId,
      userId,
      challengeId,
      challengeType: 'snapshot',
      nonce,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  }
}
