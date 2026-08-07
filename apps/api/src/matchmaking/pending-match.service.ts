import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { getAcceptTimeoutMs } from './matchmaking.constants';

const EXPIRY_ZSET_KEY = 'mm:pending:expiry';

/** TTL de segurança nas chaves cruas — quem resolve de fato uma partida vencida é o poller (`pollExpired` + `claimAndCancel`), não a expiração passiva do Redis. */
const KEY_TTL_BUFFER_MS = 60_000;

function pendingKey(matchId: string): string {
  return `mm:pending:${matchId}`;
}

/** Mesmo prefixo/estilo de `mm:user:{userId}:guard` (QueueService) — mesma entidade "usuário", outro aspecto de estado. */
function userPendingKey(userId: string): string {
  return `mm:user:${userId}:pending`;
}

export type AcceptResult =
  | { status: 'not_found' }
  | { status: 'waiting' }
  | { status: 'both_accepted'; player1Id: string; player2Id: string };

export type CancelResult =
  | { status: 'not_found' }
  | { status: 'cancelled'; player1Id: string; player2Id: string; acceptedUserIds: string[] };

/**
 * Atômico via `EXISTS` inicial (cobre a corrida contra um `claimAndCancel` concorrente que já
 * removeu o hash). A checagem de posse (`userId` é player1 ou player2?) roda em JS puro, fora
 * daqui — ver `PendingMatchService.accept` — porque `player1Id`/`player2Id` são imutáveis e uma
 * leitura solta deles nunca fica obsoleta de um jeito que mude a decisão.
 */
const ACCEPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {'not_found'}
end
redis.call('HSET', KEYS[1], ARGV[1], '1')
local a1 = redis.call('HGET', KEYS[1], 'acceptedP1')
local a2 = redis.call('HGET', KEYS[1], 'acceptedP2')
if a1 == '1' and a2 == '1' then
  local p1 = redis.call('HGET', KEYS[1], 'player1Id')
  local p2 = redis.call('HGET', KEYS[1], 'player2Id')
  redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
  redis.call('ZREM', KEYS[4], ARGV[2])
  return {'both_accepted', p1, p2}
end
return {'waiting'}
`;

/**
 * Diferente do accept, aqui `acceptedP1`/`acceptedP2` são mutáveis e a decisão de quem foi aceito
 * (usada pelo chamador para decidir requeue) depende deles — por isso não dá pra fazer uma leitura
 * solta em JS antes de reivindicar: um `accept()` concorrente poderia completar seu `HSET` entre a
 * leitura e o `DEL`, fazendo este método reportar um jogador como "não aceitou" quando na verdade
 * aceitou bem na borda do timeout. Tudo precisa ficar dentro do mesmo script atômico.
 *
 * Os nomes das chaves de ponteiro reverso são concatenados dentro do próprio Lua (só se sabe
 * player1Id/player2Id depois de ler o hash) — isso pressupõe Redis sem cluster mode (chaves de um
 * script normalmente precisam ser declaráveis de antemão para roteamento de slot em cluster); o
 * projeto usa uma única instância via `REDIS_URL`, sem evidência de cluster.
 */
const CLAIM_AND_CANCEL_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return {0}
end
local p1 = redis.call('HGET', KEYS[1], 'player1Id')
local p2 = redis.call('HGET', KEYS[1], 'player2Id')
local a1 = redis.call('HGET', KEYS[1], 'acceptedP1')
local a2 = redis.call('HGET', KEYS[1], 'acceptedP2')
redis.call('DEL', KEYS[1], 'mm:user:' .. p1 .. ':pending', 'mm:user:' .. p2 .. ':pending')
redis.call('ZREM', KEYS[2], ARGV[1])
return {1, p1, p2, a1, a2}
`;

@Injectable()
export class PendingMatchService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Chamado uma única vez, ao criar o pareamento — sem contenção (ninguém mais lê/escreve essas
   * chaves antes desta chamada retornar), então um `.pipeline()` (sem `MULTI`/transação) já basta
   * pra reduzir a janela de escrita parcial caso o processo morra no meio.
   */
  async create(matchId: string, player1Id: string, player2Id: string): Promise<void> {
    const ttlMs = getAcceptTimeoutMs() + KEY_TTL_BUFFER_MS;
    const expiresAtMs = Date.now() + getAcceptTimeoutMs();

    await this.redis
      .pipeline()
      .hset(pendingKey(matchId), {
        player1Id,
        player2Id,
        acceptedP1: '0',
        acceptedP2: '0',
      })
      .pexpire(pendingKey(matchId), ttlMs)
      .set(userPendingKey(player1Id), matchId, 'PX', ttlMs)
      .set(userPendingKey(player2Id), matchId, 'PX', ttlMs)
      .zadd(EXPIRY_ZSET_KEY, expiresAtMs, matchId)
      .exec();
  }

  /** Único uso: `leave`/`handleDisconnect`, que só têm o userId (não o matchId) em mãos. */
  async getPendingMatchId(userId: string): Promise<string | null> {
    return this.redis.get(userPendingKey(userId));
  }

  async accept(matchId: string, userId: string): Promise<AcceptResult> {
    const fields = await this.redis.hmget(pendingKey(matchId), 'player1Id', 'player2Id');
    const player1Id = fields[0];
    const player2Id = fields[1];
    if (
      player1Id === null ||
      player1Id === undefined ||
      player2Id === null ||
      player2Id === undefined
    ) {
      return { status: 'not_found' };
    }
    if (userId !== player1Id && userId !== player2Id) {
      return { status: 'not_found' };
    }
    const field = userId === player1Id ? 'acceptedP1' : 'acceptedP2';

    const result = (await this.redis.eval(
      ACCEPT_SCRIPT,
      4,
      pendingKey(matchId),
      userPendingKey(player1Id),
      userPendingKey(player2Id),
      EXPIRY_ZSET_KEY,
      field,
      matchId,
    )) as [string, string?, string?];

    if (result[0] === 'both_accepted') {
      return {
        status: 'both_accepted',
        player1Id: result[1] as string,
        player2Id: result[2] as string,
      };
    }
    if (result[0] === 'waiting') {
      return { status: 'waiting' };
    }
    return { status: 'not_found' };
  }

  /** Compartilhado pelo poller de timeout e por `leave`/`handleDisconnect` — idempotente (not_found se já resolvido). */
  async claimAndCancel(matchId: string): Promise<CancelResult> {
    const result = (await this.redis.eval(
      CLAIM_AND_CANCEL_SCRIPT,
      2,
      pendingKey(matchId),
      EXPIRY_ZSET_KEY,
      matchId,
    )) as [number, string?, string?, string?, string?];

    if (result[0] === 0) {
      return { status: 'not_found' };
    }

    const player1Id = result[1] as string;
    const player2Id = result[2] as string;
    const acceptedUserIds: string[] = [];
    if (result[3] === '1') acceptedUserIds.push(player1Id);
    if (result[4] === '1') acceptedUserIds.push(player2Id);

    return { status: 'cancelled', player1Id, player2Id, acceptedUserIds };
  }

  /** Só lê candidatos vencidos — `claimAndCancel` por matchId é quem resolve/remove de fato. */
  async pollExpired(nowMs: number, limit = 50): Promise<string[]> {
    return this.redis.zrangebyscore(EXPIRY_ZSET_KEY, '-inf', nowMs, 'LIMIT', 0, limit);
  }
}
