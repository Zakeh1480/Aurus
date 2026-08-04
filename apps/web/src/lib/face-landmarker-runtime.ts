import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

import type { FaceDetectionSample } from "./aura-features-extraction";

/**
 * URLs fixas e pinadas na MESMA versão de @mediapipe/tasks-vision instalada
 * (package.json) — o pacote não empacota de forma confiável via
 * bundler/Turbopack (WASM + loader interno), então o fileset e o modelo são
 * buscados de CDNs em runtime. Ao atualizar a versão do pacote, atualizar
 * também o "@1.0.1" abaixo. Path do modelo é versionado ("/1/", não
 * "/latest/") pelo mesmo motivo de reprodutibilidade.
 */
const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Singleton lazy — reaproveitado tanto pelo worker quanto pelo fallback main-thread. */
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= FilesetResolver.forVisionTasks(WASM_BASE_URL).then((fileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    }),
  );
  return landmarkerPromise;
}

export function toFaceDetectionSample(result: FaceLandmarkerResult): FaceDetectionSample | null {
  const landmarks = result.faceLandmarks[0];
  if (!landmarks) return null;

  const blendshapes: Record<string, number> = {};
  for (const category of result.faceBlendshapes[0]?.categories ?? []) {
    blendshapes[category.categoryName] = category.score;
  }

  return { landmarks: landmarks.map((point) => ({ x: point.x, y: point.y })), blendshapes };
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
