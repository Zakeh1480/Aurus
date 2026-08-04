import { describe, expect, it } from "vitest";

import {
  initialMatchmakingState,
  MATCHMAKING_NOTICES,
  type MatchmakingState,
  parseWsExceptionMessage,
  reduceMatchmakingState,
} from "../../src/lib/matchmaking-reducer.js";

const MATCH_ID = "8f14e45f-ceea-467e-adc6-11a75d3f8e1a";
const OTHER_MATCH_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const OPPONENT_ID = "3d594650-3436-11e8-9d31-b0c04b5cabb0";
const MATCHED_AT = "2026-08-04T12:00:00.000Z";

const matchedState = (overrides: Partial<Extract<MatchmakingState, { status: "matched" }>> = {}): MatchmakingState => ({
  status: "matched",
  matchId: MATCH_ID,
  opponentId: OPPONENT_ID,
  matchedAt: MATCHED_AT,
  accepted: false,
  leaveRequested: false,
  ...overrides,
});

describe("reduceMatchmakingState", () => {
  it("idle + JOIN_REQUESTED -> queueing", () => {
    const next = reduceMatchmakingState(initialMatchmakingState, { type: "JOIN_REQUESTED" });
    expect(next).toEqual({ status: "queueing" });
  });

  it("fluxo feliz completo: join -> matched -> accept -> match:start -> redirecting", () => {
    let state = initialMatchmakingState;
    state = reduceMatchmakingState(state, { type: "JOIN_REQUESTED" });
    state = reduceMatchmakingState(state, {
      type: "QUEUE_MATCHED",
      payload: { matchId: MATCH_ID, opponentId: OPPONENT_ID, queueStatus: "matched", matchedAt: MATCHED_AT },
    });
    expect(state).toEqual(matchedState());

    state = reduceMatchmakingState(state, { type: "ACCEPT_REQUESTED" });
    expect(state).toEqual(matchedState({ accepted: true }));

    state = reduceMatchmakingState(state, {
      type: "MATCH_START",
      payload: { matchId: MATCH_ID, player1Id: OPPONENT_ID, player2Id: OPPONENT_ID, startedAt: MATCHED_AT },
    });
    expect(state).toEqual({ status: "redirecting", matchId: MATCH_ID });
  });

  it("matched + ACCEPT_REQUESTED repetido é idempotente", () => {
    const accepted = matchedState({ accepted: true });
    const next = reduceMatchmakingState(accepted, { type: "ACCEPT_REQUESTED" });
    expect(next).toBe(accepted);
  });

  it("queueing + LEAVE_REQUESTED -> idle com notice de saída", () => {
    const next = reduceMatchmakingState({ status: "queueing" }, { type: "LEAVE_REQUESTED" });
    expect(next).toEqual({ status: "idle", notice: MATCHMAKING_NOTICES.leftQueue });
  });

  it("cancelamento explícito a partir de matched, antes de aceitar", () => {
    let state = matchedState();
    state = reduceMatchmakingState(state, { type: "LEAVE_REQUESTED" });
    expect(state).toEqual(matchedState({ leaveRequested: true }));

    state = reduceMatchmakingState(state, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: MATCHED_AT, reason: "cancelled" },
    });
    expect(state).toEqual({ status: "idle", notice: MATCHMAKING_NOTICES.cancelledRemoved });
  });

  it("cancelamento explícito a partir de matched, depois de aceitar: leave sempre vence", () => {
    let state = matchedState({ accepted: true });
    state = reduceMatchmakingState(state, { type: "LEAVE_REQUESTED" });
    expect(state).toEqual(matchedState({ accepted: true, leaveRequested: true }));

    state = reduceMatchmakingState(state, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: MATCHED_AT, reason: "cancelled" },
    });
    expect(state).toEqual({ status: "idle", notice: MATCHMAKING_NOTICES.cancelledRemoved });
  });

  it("timeout sem ter aceitado -> idle", () => {
    const state = matchedState();
    const next = reduceMatchmakingState(state, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: MATCHED_AT, reason: "cancelled" },
    });
    expect(next).toEqual({ status: "idle", notice: MATCHMAKING_NOTICES.cancelledRemoved });
  });

  it("timeout tendo aceitado -> queueing (reinserido silenciosamente pelo servidor)", () => {
    const state = matchedState({ accepted: true });
    const next = reduceMatchmakingState(state, {
      type: "MATCH_END",
      payload: { matchId: MATCH_ID, endedAt: MATCHED_AT, reason: "cancelled" },
    });
    expect(next).toEqual({ status: "queueing", notice: MATCHMAKING_NOTICES.cancelledRequeued });
  });

  it("MATCH_END com matchId divergente é ignorado", () => {
    const state = matchedState({ accepted: true });
    const next = reduceMatchmakingState(state, {
      type: "MATCH_END",
      payload: { matchId: OTHER_MATCH_ID, endedAt: MATCHED_AT, reason: "cancelled" },
    });
    expect(next).toBe(state);
  });

  it("MATCH_START com matchId divergente é ignorado", () => {
    const state = matchedState();
    const next = reduceMatchmakingState(state, {
      type: "MATCH_START",
      payload: { matchId: OTHER_MATCH_ID, player1Id: OPPONENT_ID, player2Id: OPPONENT_ID, startedAt: MATCHED_AT },
    });
    expect(next).toBe(state);
  });

  it.each([
    ["idle", { status: "idle" } satisfies MatchmakingState, { type: "LEAVE_REQUESTED" } as const],
    ["idle", { status: "idle" } satisfies MatchmakingState, { type: "ACCEPT_REQUESTED" } as const],
    ["queueing", { status: "queueing" } satisfies MatchmakingState, { type: "ACCEPT_REQUESTED" } as const],
    ["queueing", { status: "queueing" } satisfies MatchmakingState, { type: "JOIN_REQUESTED" } as const],
  ])("ignora ação fora de contexto: %s + %o", (_label, state, action) => {
    const next = reduceMatchmakingState(state, action);
    expect(next).toBe(state);
  });

  it("redirecting ignora qualquer ação, incluindo MATCH_END e WS_EXCEPTION", () => {
    const state: MatchmakingState = { status: "redirecting", matchId: MATCH_ID };
    expect(
      reduceMatchmakingState(state, {
        type: "MATCH_END",
        payload: { matchId: MATCH_ID, endedAt: MATCHED_AT, reason: "completed" },
      }),
    ).toBe(state);
    expect(reduceMatchmakingState(state, { type: "WS_EXCEPTION", message: "erro" })).toBe(state);
  });

  it.each<[string, MatchmakingState]>([
    ["idle", { status: "idle" }],
    ["queueing", { status: "queueing" }],
    ["matched", matchedState()],
  ])("WS_EXCEPTION a partir de %s -> error", (_label, state) => {
    const next = reduceMatchmakingState(state, { type: "WS_EXCEPTION", message: "deu ruim" });
    expect(next).toEqual({ status: "error", message: "deu ruim" });
  });

  it("error + RESET -> idle", () => {
    const next = reduceMatchmakingState({ status: "error", message: "x" }, { type: "RESET" });
    expect(next).toEqual({ status: "idle" });
  });

  it("error + JOIN_REQUESTED -> queueing (retry)", () => {
    const next = reduceMatchmakingState({ status: "error", message: "x" }, { type: "JOIN_REQUESTED" });
    expect(next).toEqual({ status: "queueing" });
  });
});

describe("parseWsExceptionMessage", () => {
  it("extrai a mensagem de um payload válido", () => {
    expect(parseWsExceptionMessage({ status: "error", message: "Usuário já está na fila." })).toBe(
      "Usuário já está na fila.",
    );
  });

  it.each([{}, null, undefined, "string solta", 42])("retorna fallback para payload inválido: %o", (raw) => {
    expect(parseWsExceptionMessage(raw)).toBe("Erro inesperado no matchmaking. Tente novamente.");
  });
});
