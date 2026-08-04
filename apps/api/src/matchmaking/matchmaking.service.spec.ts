import type { Profile } from "@aurafarming/shared";
import { Test } from "@nestjs/testing";
import { WsException } from "@nestjs/websockets";
import type { Socket } from "socket.io";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { MatchmakingService } from "./matchmaking.service";
import { QueueService } from "./queue.service";

function buildProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    userId: "user-x",
    nickname: "Player",
    avatarUrl: null,
    bio: null,
    rating: 1000,
    auraScoreAvg: null,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fakeSocket(): Socket {
  return { emit: vi.fn() } as unknown as Socket;
}

describe("MatchmakingService", () => {
  let service: MatchmakingService;
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
  let prisma: {
    match: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let usersService: { getProfile: ReturnType<typeof vi.fn> };
  let txMock: { match: { create: ReturnType<typeof vi.fn> }; matchParticipant: { createMany: ReturnType<typeof vi.fn> } };

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
    txMock = {
      match: { create: vi.fn() },
      matchParticipant: { createMany: vi.fn() },
    };
    prisma = {
      match: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn((callback: (tx: typeof txMock) => unknown) => callback(txMock)),
    };
    usersService = { getProfile: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        { provide: QueueService, useValue: queueService },
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(MatchmakingService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Pareia user-a (já esperando) com user-b (quem dispara o pareamento). */
  async function setupPendingMatch(matchId = "match-1", createdAt = new Date("2026-01-01T00:00:00.000Z")) {
    queueService.claimGuard.mockResolvedValue(true);
    usersService.getProfile.mockImplementation((userId: string) =>
      Promise.resolve(buildProfile({ userId, rating: userId === "user-a" ? 1000 : 1010 })),
    );
    const socketA = fakeSocket();
    const socketB = fakeSocket();
    service.registerSocket("user-a", socketA);
    service.registerSocket("user-b", socketB);

    queueService.findCandidates.mockResolvedValueOnce([]);
    await service.join("user-a");

    queueService.findCandidates.mockResolvedValueOnce([{ userId: "user-a", rating: 1000 }]);
    queueService.claimPair.mockResolvedValueOnce(true);
    txMock.match.create.mockResolvedValueOnce({
      id: matchId,
      player1Id: "user-a",
      player2Id: "user-b",
      status: "pending",
      createdAt,
    });
    await service.join("user-b");

    // O "arrange" acima já disparou addToQueue/leaveQueue como parte normal
    // do join — zera o histórico de chamadas para os testes de accept/
    // timeout/desconexão observarem só o que acontece na fase de "act".
    queueService.addToQueue.mockClear();
    queueService.leaveQueue.mockClear();

    return { matchId, socketA, socketB };
  }

  describe("join — pareamento de dois clientes", () => {
    it("cria Match/MatchParticipant e os dois sockets recebem queue:matched com o mesmo matchId", async () => {
      const { matchId, socketA, socketB } = await setupPendingMatch();

      expect(txMock.match.create).toHaveBeenCalledTimes(1);
      expect(txMock.match.create).toHaveBeenCalledWith({
        data: { player1Id: "user-a", player2Id: "user-b", status: "pending" },
      });
      expect(txMock.matchParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { matchId, userId: "user-a", side: "player1", ratingBefore: 1000, ratingAfter: null },
          { matchId, userId: "user-b", side: "player2", ratingBefore: 1010, ratingAfter: null },
        ],
      });

      expect(socketA.emit).toHaveBeenCalledWith("queue:matched", {
        matchId,
        opponentId: "user-b",
        queueStatus: "matched",
        matchedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(socketB.emit).toHaveBeenCalledWith("queue:matched", {
        matchId,
        opponentId: "user-a",
        queueStatus: "matched",
        matchedAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("idempotência", () => {
    it("rejeita join quando o guard Redis já está reivindicado", async () => {
      queueService.claimGuard.mockResolvedValue(false);

      await expect(service.join("user-a")).rejects.toBeInstanceOf(WsException);
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(txMock.match.create).not.toHaveBeenCalled();
    });

    it("rejeita e desfaz o guard quando o Postgres encontra uma partida aberta órfã", async () => {
      queueService.claimGuard.mockResolvedValue(true);
      prisma.match.findFirst.mockResolvedValue({ id: "old-match" });

      await expect(service.join("user-a")).rejects.toBeInstanceOf(WsException);
      expect(queueService.releaseGuard).toHaveBeenCalledWith("user-a");
      expect(txMock.match.create).not.toHaveBeenCalled();
    });
  });

  describe("fallback de corrida no pareamento", () => {
    it("segue para o próximo candidato quando claimPair perde a corrida no melhor candidato", async () => {
      queueService.claimGuard.mockResolvedValue(true);
      usersService.getProfile.mockResolvedValue(buildProfile({ userId: "self", rating: 1000 }));
      queueService.findCandidates.mockResolvedValue([
        { userId: "near", rating: 1005 },
        { userId: "far", rating: 1030 },
      ]);
      queueService.claimPair.mockImplementation((_self: string, candidateId: string) =>
        Promise.resolve(candidateId !== "near"),
      );
      txMock.match.create.mockResolvedValue({
        id: "match-2",
        player1Id: "far",
        player2Id: "self",
        status: "pending",
        createdAt: new Date(),
      });

      await service.join("self");

      expect(queueService.claimPair).toHaveBeenNthCalledWith(1, "self", "near");
      expect(queueService.claimPair).toHaveBeenNthCalledWith(2, "self", "far");
      expect(txMock.match.create).toHaveBeenCalledWith({
        data: { player1Id: "far", player2Id: "self", status: "pending" },
      });
    });
  });

  describe("aceite com timeout", () => {
    it("timeout cancela e recoloca só quem aceitou", async () => {
      vi.useFakeTimers();
      const { matchId, socketA, socketB } = await setupPendingMatch();

      await service.accept("user-a", matchId);
      queueService.findCandidates.mockResolvedValue([]);

      await vi.advanceTimersByTimeAsync(10_000);

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: "cancelled", endedAt: expect.any(Date) },
      });
      expect(socketA.emit).toHaveBeenCalledWith("match:end", {
        matchId,
        endedAt: expect.any(String),
        reason: "cancelled",
      });
      expect(socketB.emit).toHaveBeenCalledWith("match:end", {
        matchId,
        endedAt: expect.any(String),
        reason: "cancelled",
      });
      expect(queueService.addToQueue).toHaveBeenCalledWith("user-a", 1000, expect.any(Number));
      expect(queueService.addToQueue).not.toHaveBeenCalledWith(
        "user-b",
        expect.anything(),
        expect.anything(),
      );
      expect(queueService.leaveQueue).toHaveBeenCalledWith("user-b");
    });

    it("ambos aceitam a tempo: ativa a partida e cancela o timer (sem cancelamento tardio)", async () => {
      vi.useFakeTimers();
      const { matchId, socketA, socketB } = await setupPendingMatch();

      await service.accept("user-a", matchId);
      await service.accept("user-b", matchId);

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: "active", startedAt: expect.any(Date) },
      });
      const expectedStartPayload = {
        matchId,
        player1Id: "user-a",
        player2Id: "user-b",
        startedAt: expect.any(String),
      };
      expect(socketA.emit).toHaveBeenCalledWith("match:start", expectedStartPayload);
      expect(socketB.emit).toHaveBeenCalledWith("match:start", expectedStartPayload);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(prisma.match.update).toHaveBeenCalledTimes(1);
    });

    it("rejeita accept para matchId que não corresponde à partida pendente do usuário", async () => {
      const { matchId } = await setupPendingMatch();
      await expect(service.accept("user-a", `${matchId}-outro`)).rejects.toBeInstanceOf(WsException);
    });
  });

  describe("desconexão", () => {
    it("em partida pendente: recoloca quem aceitou, libera quem não aceitou", async () => {
      vi.useFakeTimers();
      const { matchId } = await setupPendingMatch();
      await service.accept("user-a", matchId);
      queueService.findCandidates.mockResolvedValue([]);

      await service.handleDisconnect("user-b");

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: matchId },
        data: { status: "cancelled", endedAt: expect.any(Date) },
      });
      expect(queueService.addToQueue).toHaveBeenCalledWith("user-a", 1000, expect.any(Number));
      expect(queueService.leaveQueue).toHaveBeenCalledWith("user-b");
    });

    it("desconexão do próprio jogador que tinha aceitado força não-requeue dele mesmo", async () => {
      vi.useFakeTimers();
      const { matchId } = await setupPendingMatch();
      await service.accept("user-a", matchId);

      await service.handleDisconnect("user-a");

      expect(queueService.addToQueue).not.toHaveBeenCalled();
      expect(queueService.leaveQueue).toHaveBeenCalledWith("user-a");
      expect(queueService.leaveQueue).toHaveBeenCalledWith("user-b");
    });

    it("não tenta emitir no socket do próprio usuário que acabou de desconectar", async () => {
      vi.useFakeTimers();
      const { matchId, socketB } = await setupPendingMatch();
      await service.accept("user-a", matchId);

      await expect(service.handleDisconnect("user-a")).resolves.not.toThrow();
      expect(socketB.emit).toHaveBeenCalledWith("match:end", expect.objectContaining({ matchId }));
    });

    it("desconexão só na fila: apenas leaveQueue, sem tocar o Match", async () => {
      await service.handleDisconnect("solo-user");
      expect(queueService.leaveQueue).toHaveBeenCalledWith("solo-user");
      expect(prisma.match.update).not.toHaveBeenCalled();
    });
  });
});
