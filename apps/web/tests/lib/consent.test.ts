import { describe, expect, it } from "vitest";
import type { ConsentStatus } from "@aurafarming/shared";

import { CAMERA_CONSENT_TERMS_VERSION, isCameraConsentGranted } from "../../src/lib/consent.js";

describe("isCameraConsentGranted", () => {
  it("retorna true quando o consentimento de câmera foi concedido", () => {
    const statuses: ConsentStatus[] = [
      { type: "camera", granted: true, termsVersion: "v1", grantedAt: "2026-08-01T00:00:00.000Z" },
    ];

    expect(isCameraConsentGranted(statuses)).toBe(true);
  });

  it("retorna false quando o consentimento de câmera não foi concedido", () => {
    const statuses: ConsentStatus[] = [{ type: "camera", granted: false, termsVersion: null, grantedAt: null }];

    expect(isCameraConsentGranted(statuses)).toBe(false);
  });

  it("retorna false quando não há nenhuma entrada de câmera", () => {
    expect(isCameraConsentGranted([])).toBe(false);
  });
});

describe("CAMERA_CONSENT_TERMS_VERSION", () => {
  it("respeita o limite de 32 caracteres de GrantConsentRequestSchema.termsVersion", () => {
    expect(CAMERA_CONSENT_TERMS_VERSION.length).toBeGreaterThan(0);
    expect(CAMERA_CONSENT_TERMS_VERSION.length).toBeLessThanOrEqual(32);
  });
});
