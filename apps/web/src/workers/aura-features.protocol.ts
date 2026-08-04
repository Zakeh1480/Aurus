import type { FaceDetectionSample } from "../lib/aura-features-extraction";

export type AuraFeaturesWorkerRequest =
  | { type: "detect"; bitmap: ImageBitmap; timestampMs: number }
  | { type: "dispose" };

export type AuraFeaturesWorkerResponse =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "result"; sample: FaceDetectionSample | null };
