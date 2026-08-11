import type { Profile } from '@aurafarming/shared';
import { Test } from '@nestjs/testing';
import { WsException } from '@nestjs/websockets';
import type { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { getAcceptTimeoutMs } from './matchmaking.constants';
import { MatchmakingService, userRoom } from './matchmaking.service';
import type { AcceptResult, CancelResult } from './pending-match.service';
import { PendingMatchService } from './pending-match.service';
import { QueueService } from './queue.service';

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: 'user-x',
    nickname: 'Player',
    avatarUrl: null,
    bio: null,
    rating: 1000,
    auraScoreAvg: null,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface RecordedEmit {
  room: string;
  event: string;
  payload: unknown;
}

function fakeServer() {
  const recorded: RecordedEmit[] = [];
  const disconnectedRooms: string[] = [];
  const server = {
    to: vi.fn((room: string) => ({
      emit: (event: string, payload: unknown) => recorded.push({ room, event, payload }),
    })),
    in: vi.fn((room: string) => ({
      disconnectSockets: (close: boolean) => {
        if (close) disconnectedRooms.push(room);
      },
    })),
  };
  return { server: server as unknown as Server, recorded, disconnectedRooms };
}

interface FakePendingEntry {
  player1Id: string;
  player2Id: string;
  acceptedP1: boolean;
  acceptedP2: boolean;
  expiresAtMs: number;
}

function fakePendingMatchService() {
  const byMatchId = new Map<string, FakePendingEntry>();
  const byUserId = new Map<string, string>();

  return {
    create: vi.fn(async (matchId: string, player1Id: string, player2Id: string): Promise<void> => {
      byMatchId.set(matchId, {
        player1Id,
        player2Id,
        acceptedP1: false,
        acceptedP2: false,
        expiresAtMs: Date.now() + getAcceptTimeoutMs(),
      });
      byUserId.set(player1Id, matchId);
      byUserId.set(player2Id, matchId);
    }),

    getPendingMatchId: vi.fn(async (userId: string): Promise<string | null> => {
      return byUserId.get(userId) ?? null;
    }),

    accept: vi.fn(async (matchId: string, userId: string): Promise<AcceptResult> => {
      const entry = byMatchId.get(matchId);
      if (!entry) return { status: 'not_found' };
      if (userId !== entry.player1Id && userId !== entry.player2Id) return { status: 'not_found' };

      if (userId === entry.player1Id) entry.acceptedP1 = true;
      else entry.acceptedP2 = true;

      if (entry.acceptedP1 && entry.acceptedP2) {
        byMatchId.delete(matchId);
        byUserId.delete(entry.player1Id);
        byUserId.delete(entry.player2Id);
        return { status: 'both_accepted', player1Id: entry.player1Id, player2Id: entry.player2Id };
      }
      return { status: 'waiting' };
    }),

    claimAndCancel: vi.fn(async (matchId: string): Promise<CancelResult> => {
      const entry = byMatchId.get(matchId);
      if (!entry) return { status: 'not_found' };

      byMatchId.delete(matchId);
      byUserId.delete(entry.player1Id);
      byUserId.delete(entry.player2Id);

      const acceptedUserIds: string[] = [];
      if (entry.acceptedP1) acceptedUserIds.push(entry.player1Id);
      if (entry.acceptedP2) acceptedUserIds.push(entry.player2Id);

      return {
        status: 'cancelled',
        player1Id: entry.player1Id,
        player2Id: entry.player2Id,
        acceptedUserIds,
      };
    }),

    pollExpired: vi.fn(async (nowMs: number, limit = 50): Promise<string[]> => {
      const due: string[] = [];
      for (const [matchId, entry] of byMatchId) {
        if (entry.expiresAtMs <= nowMs) {
          due.push(matchId);
          if (due.length >= limit) break;
        }
      }
      return due;
    }),
  };
}

describe('MatchmakingService', () => {
  let service: MatchmakingService;
  let server: ReturnType<typeof fakeServer>;
  let queueService: {
    claimGuard: ReturnType<typeof vi.fn>;
    releaseGuard: ReturnType<typeof vi.fn>;
    addToQueue: ReturnType<typeof vi.fn>;
    leaveQueue: ReturnType<typeof vi.fn>;
    getJoinedAt: ReturnType<typeof vi.fn>;
    clearWaitClock: ReturnType<typeof vi.fn>;
    findCandidates: ReturnType<typeof vi.fn>;
    claimPair: ReturnType<typeof vi.fn>;
  };
  let pendingMatchService: ReturnType<typeof fakePendingMatchService>;
  let prisma: {
    match: {
      findFirst: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let usersService: { getProfile: ReturnType<typeof vi.fn> };
  let txMock: {
    match: { create: ReturnType<typeof vi.fn> };
    matchParticipant: { createMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    queueService = {
      claimGuard: vi.fn(),
      releaseGuard: vi.fn(),
      addToQueue: vi.fn(),
      leaveQueue: vi.fn(),
      getJoinedAt: vi.fn().mockResolvedValue(0),
      clearWaitClock: vi.fn(),
      findCandidates: vi.fn(),
      claimPair: vi.fn(),
    };
    pendingMatchService = fakePendingMatchService();
    txMock = {
      match: { create: vi.fn() },
      matchParticipant: { createMany: vi.fn() },
    };
    prisma = {
      match: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    };
    usersService = { getProfile: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: QueueService, useValue: queueService },
        { provide: PendingMatchService, useValue: pendingMatchService },
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(MatchmakingService);
    server = fakeServer();
    service.setServer(server.server);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setupPendingMatch(
    matchId = 'match-1',
    createdAt = new Date('2026-01-01T00:00:00.000Z'),
  ) {
    queueService.claimGuard.mockResolvedValue(true);
    usersService.getProfile.mockImplementation((userId: string) =>
      Promise.resolve(buildProfile({ userId, rating: userId === 'user-a' ? 1000 : 1010 })),
    );

    queueService.findCandidates.mockResolvedValueOnce([]);
    await service.join('user-a');

    queueService.findCandidates.mockResolvedValueOnce([{ userId: 'user-a', rating: 1000 }]);
    queueService.claimPair.mockResolvedValueOnce(true);
    txMock.match.create.mockResolvedValueOnce({
      id: matchId,
      player1Id: 'user-a',
      player2Id: 'user-b',
      status: 'pending',
      createdAt,
    });
    await service.join('user-b');

    queueService.addToQueue.mockClear();
    queueService.leaveQueue.mockClear();

    return { matchId };
  }

  describe('join — pareamento de dois clientes', () => {
    it('cria Match/MatchParticipant e os dois usuários recebem queue:matched com o mesmo matchId', async () => {
      const { matchId } = await setupPendingMatch();

      expect(txMock.match.create).toHaveBeenCalledTimes(1);
      expect(txMock.match.create).toHaveBeenCalledWith({
        data: { player1Id: 'user-a', player2Id: 'user-b', status: 'pending' },
      });
      expect(txMock.matchParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { matchId, userId: 'user-a', side: 'player1', ratingBefore: 1000, ratingAfter: null },
          { matchId, userId: 'user-b', side: 'player2', ratingBefore: 1010, ratingAfter: null },
        ],
      });

      expect(server.recorded).toContainEqual({
        room: userRoom('user-a'),
        event: 'queue:matched',
        payload: {
          matchId,
          opponentId: 'user-b',
          queueStatus: 'matched',
          matchedAt: '2026-01-01T00:00:00.000Z',
        },
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-b'),
        event: 'queue:matched',
        payload: {
          matchId,
          opponentId: 'user-a',
          queueStatus: 'matched',
          matchedAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });
  });

  describe('idempotência', () => {
    it('rejeita join quando o guard Redis já está reivindicado', async () => {
      queueService.claimGuard.mockResolvedValue(false);

      await expect(service.join('user-a')).rejects.toBeInstanceOf(WsException);
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(txMock.match.create).not.toHaveBeenCalled();
    });

    it('rejeita e desfaz o guard quando o Postgres encontra uma partida aberta órfã', async () => {
      queueService.claimGuard.mockResolvedValue(true);
      prisma.match.findFirst.mockResolvedValue({ id: 'old-match' });

      await expect(service.join('user-a')).rejects.toBeInstanceOf(WsException);
      expect(queueService.releaseGuard).toHaveBeenCalledWith('user-a');
      expect(txMock.match.create).not.toHaveBeenCalled();
    });
  });

  describe('fallback de corrida no pareamento', () => {
    it('segue para o próximo candidato quando claimPair perde a corrida no melhor candidato', async () => {
      queueService.claimGuard.mockResolvedValue(true);
      usersService.getProfile.mockResolvedValue(buildProfile({ userId: 'self', rating: 1000 }));
      queueService.findCandidates.mockResolvedValue([
        { userId: 'near', rating: 1005 },
        { userId: 'far', rating: 1030 },
      ]);
      queueService.claimPair.mockImplementation((_self: string, candidateId: string) =>
        Promise.resolve(candidateId !== 'near'),
      );
      txMock.match.create.mockResolvedValue({
        id: 'match-2',
        player1Id: 'far',
        player2Id: 'self',
        status: 'pending',
        createdAt: new Date(),
      });

      await service.join('self');

      expect(queueService.claimPair).toHaveBeenNthCalledWith(1, 'self', 'near');
      expect(queueService.claimPair).toHaveBeenNthCalledWith(2, 'self', 'far');
      expect(txMock.match.create).toHaveBeenCalledWith({
        data: { player1Id: 'far', player2Id: 'self', status: 'pending' },
      });
    });
  });

  describe('aceite com timeout', () => {
    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime();

    it('timeout cancela e recoloca só quem aceitou', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);
      const { matchId } = await setupPendingMatch();

      await service.accept('user-a', matchId);
      queueService.findCandidates.mockResolvedValue([]);

      dateNowSpy.mockReturnValue(baseTime + getAcceptTimeoutMs());
      await service.pollExpiredPendingMatches();

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: 'cancelled', endedAt: expect.any(Date) },
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-a'),
        event: 'match:end',
        payload: { matchId, endedAt: expect.any(String), reason: 'cancelled' },
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-b'),
        event: 'match:end',
        payload: { matchId, endedAt: expect.any(String), reason: 'cancelled' },
      });
      expect(queueService.addToQueue).toHaveBeenCalledWith('user-a', 1000, expect.any(Number));
      expect(queueService.addToQueue).not.toHaveBeenCalledWith(
        'user-b',
        expect.anything(),
        expect.anything(),
      );
      expect(queueService.leaveQueue).toHaveBeenCalledWith('user-b');
    });

    it('ambos aceitam a tempo: ativa a partida e não sofre cancelamento tardio num poll seguinte', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);
      const { matchId } = await setupPendingMatch();

      await service.accept('user-a', matchId);
      await service.accept('user-b', matchId);

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: 'active', startedAt: expect.any(Date) },
      });
      const expectedStartPayload = {
        matchId,
        player1Id: 'user-a',
        player2Id: 'user-b',
        startedAt: expect.any(String),
      };
      expect(server.recorded).toContainEqual({
        room: userRoom('user-a'),
        event: 'match:start',
        payload: expectedStartPayload,
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-b'),
        event: 'match:start',
        payload: expectedStartPayload,
      });

      dateNowSpy.mockReturnValue(baseTime + 60_000);
      await service.pollExpiredPendingMatches();
      expect(prisma.match.update).toHaveBeenCalledTimes(1);
    });

    it('rejeita accept para matchId que não corresponde à partida pendente do usuário', async () => {
      const { matchId } = await setupPendingMatch();
      await expect(service.accept('user-a', `${matchId}-outro`)).rejects.toBeInstanceOf(
        WsException,
      );
    });
  });

  describe('desconexão', () => {
    it('em partida pendente: recoloca quem aceitou, libera quem não aceitou', async () => {
      const { matchId } = await setupPendingMatch();
      await service.accept('user-a', matchId);
      queueService.findCandidates.mockResolvedValue([]);

      await service.handleDisconnect('user-b');

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: 'cancelled', endedAt: expect.any(Date) },
      });
      expect(queueService.addToQueue).toHaveBeenCalledWith('user-a', 1000, expect.any(Number));
      expect(queueService.leaveQueue).toHaveBeenCalledWith('user-b');
    });

    it('desconexão do próprio jogador que tinha aceitado força não-requeue dele mesmo', async () => {
      const { matchId } = await setupPendingMatch();
      await service.accept('user-a', matchId);

      await service.handleDisconnect('user-a');

      expect(queueService.addToQueue).not.toHaveBeenCalled();
      expect(queueService.leaveQueue).toHaveBeenCalledWith('user-a');
      expect(queueService.leaveQueue).toHaveBeenCalledWith('user-b');
    });

    it('mesmo desconectando, o outro jogador ainda recebe match:end (a room dele é alcançada normalmente)', async () => {
      const { matchId } = await setupPendingMatch();
      await service.accept('user-a', matchId);

      await expect(service.handleDisconnect('user-a')).resolves.not.toThrow();
      expect(server.recorded).toContainEqual({
        room: userRoom('user-b'),
        event: 'match:end',
        payload: expect.objectContaining({ matchId }),
      });
    });

    it('desconexão só na fila: apenas leaveQueue, sem tocar o Match', async () => {
      await service.handleDisconnect('solo-user');
      expect(queueService.leaveQueue).toHaveBeenCalledWith('solo-user');
      expect(prisma.match.update).not.toHaveBeenCalled();
    });
  });

  describe('endActiveMatch — encerramento disparado pelo webhook do LiveKit', () => {
    it('no-op quando a partida não existe', async () => {
      prisma.match.findUnique.mockResolvedValue(null);

      await service.endActiveMatch('match-inexistente', 'disconnected');

      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('no-op quando a partida existe mas não está active', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        player1Id: 'user-a',
        player2Id: 'user-b',
        status: 'cancelled',
      });

      await service.endActiveMatch('match-1', 'disconnected');

      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('marca cancelled, seta endedAt e emite match:end (reason: disconnected) para os dois jogadores', async () => {
      prisma.match.findUnique.mockResolvedValue({
        id: 'match-1',
        player1Id: 'user-a',
        player2Id: 'user-b',
        status: 'active',
      });

      await service.endActiveMatch('match-1', 'disconnected');

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: 'cancelled', endedAt: expect.any(Date) },
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-a'),
        event: 'match:end',
        payload: { matchId: 'match-1', endedAt: expect.any(String), reason: 'disconnected' },
      });
      expect(server.recorded).toContainEqual({
        room: userRoom('user-b'),
        event: 'match:end',
        payload: { matchId: 'match-1', endedAt: expect.any(String), reason: 'disconnected' },
      });
    });
  });

  describe('disconnectUser', () => {
    it('desconecta via a room do usuário — alcança o socket mesmo em outra réplica através do adapter Redis', () => {
      service.disconnectUser('user-a');

      expect(server.server.in).toHaveBeenCalledWith(userRoom('user-a'));
      expect(server.disconnectedRooms).toContain(userRoom('user-a'));
    });

    it('não lança quando o server ainda não foi setado (ex.: chamado antes do bootstrap terminar)', async () => {
      const moduleRef = await Test.createTestingModule({
        providers: [
          MatchmakingService,
          { provide: QueueService, useValue: queueService },
          { provide: PendingMatchService, useValue: pendingMatchService },
          { provide: PrismaService, useValue: prisma },
          { provide: UsersService, useValue: usersService },
        ],
      }).compile();
      const serviceWithoutServer = moduleRef.get(MatchmakingService);

      expect(() => serviceWithoutServer.disconnectUser('user-a')).not.toThrow();
    });
  });
});
