import { describe, expect, it } from "vitest";

import { resolveQueueEntryHref } from "../../src/lib/queue-entry.js";

describe("resolveQueueEntryHref", () => {
  it("retorna null enquanto o status de autenticação está carregando", () => {
    expect(resolveQueueEntryHref({ status: "loading", cameraConsent: "unknown" })).toBeNull();
  });

  it("manda para /login quando não autenticado", () => {
    expect(resolveQueueEntryHref({ status: "unauthenticated", cameraConsent: "unknown" })).toBe("/login");
  });

  it("retorna null enquanto o consentimento ainda está carregando", () => {
    expect(resolveQueueEntryHref({ status: "authenticated", cameraConsent: "loading" })).toBeNull();
  });

  it("manda para /consentimento quando autenticado sem consentimento de câmera", () => {
    expect(resolveQueueEntryHref({ status: "authenticated", cameraConsent: "required" })).toBe(
      "/consentimento?next=%2Ffila",
    );
  });

  it("manda para /fila quando autenticado e com consentimento concedido", () => {
    expect(resolveQueueEntryHref({ status: "authenticated", cameraConsent: "granted" })).toBe("/fila");
  });
});
