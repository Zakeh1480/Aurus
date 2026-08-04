import { describeError, getFaceLandmarker, toFaceDetectionSample } from "../lib/face-landmarker-runtime";
import type { AuraFeaturesWorkerRequest, AuraFeaturesWorkerResponse } from "./aura-features.protocol";

/**
 * O tsconfig do app usa a lib "dom" (Next.js é primariamente um app de
 * janela); TypeScript não permite combinar "dom" com "webworker" no mesmo
 * program (globais incompatíveis, ex. `self`). Em vez de bifurcar o
 * tsconfig só por causa de um worker, declaramos localmente a fatia mínima
 * da API de worker que este arquivo usa.
 */
type WorkerGlobalScope = {
  postMessage(message: AuraFeaturesWorkerResponse): void;
  addEventListener(type: "message", listener: (event: MessageEvent<AuraFeaturesWorkerRequest>) => void): void;
  close(): void;
};

const workerSelf = self as unknown as WorkerGlobalScope;

function post(message: AuraFeaturesWorkerResponse): void {
  workerSelf.postMessage(message);
}

getFaceLandmarker()
  .then(() => post({ type: "ready" }))
  .catch((error: unknown) => post({ type: "error", message: describeError(error) }));

workerSelf.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "dispose") {
    void getFaceLandmarker().then((landmarker) => landmarker.close());
    workerSelf.close();
    return;
  }

  const { bitmap, timestampMs } = message;
  getFaceLandmarker()
    .then((landmarker) => {
      const result = landmarker.detectForVideo(bitmap, timestampMs);
      post({ type: "result", sample: toFaceDetectionSample(result) });
    })
    .catch((error: unknown) => post({ type: "error", message: describeError(error) }))
    .finally(() => bitmap.close());
});
