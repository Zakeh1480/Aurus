import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, authApi, setAccessToken } from "../../src/lib/api-client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const validUser = {
  id: "8f14e45f-ceea-467e-adc6-11a75d3f8e1a",
  email: "jogador@example.com",
  displayName: "jogador",
  avatarUrl: null,
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

const validAuthResponse = {
  user: validUser,
  tokens: { accessToken: "access-token", expiresIn: 900 },
};

describe("apiClient", () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia credentials include no login (rota que usa o cookie af_refresh)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validAuthResponse));

    await authApi.login({ email: "jogador@example.com", password: "senha1234" });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.credentials).toBe("include");
  });

  it("anexa Authorization: Bearer depois de setAccessToken", async () => {
    setAccessToken("meu-token");
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validUser));

    await authApi.me();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer meu-token");
  });

  it("não anexa Authorization quando não há token", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, validUser));

    await authApi.me();

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("lança ApiError em resposta não-2xx", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(401, { message: "unauthorized" }));

    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);
  });

  it("lança ApiError quando a resposta não bate com o schema de shared", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { nonsense: true }));

    await expect(authApi.me()).rejects.toBeInstanceOf(ApiError);
  });
});
