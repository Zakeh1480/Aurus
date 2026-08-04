"use client";

import * as React from "react";

import { extractAuraMetrics, type AuraMetricValues, type FaceDetectionSample } from "@/lib/aura-features-extraction";
import { getFaceLandmarker, toFaceDetectionSample } from "@/lib/face-landmarker-runtime";
import type { AuraFeaturesWorkerRequest, AuraFeaturesWorkerResponse } from "@/workers/aura-features.protocol";

/** Cadência única de detecção — ~5 amostras por tick de 5s do servidor (MATCH_SCORE_TICK_INTERVAL_MS). */
const CAPTURE_INTERVAL_MS = 1000;

export type AuraFeaturesStatus = "initializing" | "ready" | "unavailable";

export type UseAuraFeaturesResult = {
  status: AuraFeaturesStatus;
  metrics: AuraMetricValues | null;
};

/**
 * Extrai AuraFeatures do vídeo local via MediaPipe FaceLandmarker. Tenta
 * rodar num Worker (não trava a UI); se o worker falhar por qualquer razão
 * (module worker vs. o bootstrap WASM do @mediapipe/tasks-vision é uma
 * combinação que não foi possível validar fora de um browser real — ver
 * plano do Prompt 11), cai para a mesma extração na thread principal. A
 * cadência de 1x/segundo torna esse fallback aceitável.
 */
export function useAuraFeatures(videoRef: React.RefObject<HTMLVideoElement | null>): UseAuraFeaturesResult {
  const [status, setStatus] = React.useState<AuraFeaturesStatus>("initializing");
  const [metrics, setMetrics] = React.useState<AuraMetricValues | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let worker: Worker | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const readyRef = { current: false };
    const busyRef = { current: false };
    const previousSampleRef: { current: FaceDetectionSample | null } = { current: null };

    function clearTick(): void {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function handleSample(sample: FaceDetectionSample | null): void {
      busyRef.current = false;
      if (cancelled) return;
      setMetrics(extractAuraMetrics(sample, previousSampleRef.current));
      previousSampleRef.current = sample;
    }

    async function captureTickWorker(): Promise<void> {
      const video = videoRef.current;
      if (!worker || !video || video.readyState < 2 || busyRef.current) return;
      busyRef.current = true;
      try {
        const bitmap = await createImageBitmap(video);
        worker.postMessage(
          { type: "detect", bitmap, timestampMs: performance.now() } satisfies AuraFeaturesWorkerRequest,
          [bitmap],
        );
      } catch {
        busyRef.current = false;
      }
    }

    async function captureTickMainThread(): Promise<void> {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || busyRef.current) return;
      busyRef.current = true;
      try {
        const landmarker = await getFaceLandmarker();
        const result = landmarker.detectForVideo(video, performance.now());
        handleSample(toFaceDetectionSample(result));
      } catch {
        busyRef.current = false;
      }
    }

    function startMainThreadFallback(): void {
      if (cancelled) return;
      clearTick();
      worker?.terminate();
      worker = null;
      busyRef.current = false;

      getFaceLandmarker()
        .then(() => {
          if (cancelled) return;
          readyRef.current = true;
          setStatus("ready");
          intervalId = setInterval(() => void captureTickMainThread(), CAPTURE_INTERVAL_MS);
        })
        .catch(() => {
          if (!cancelled) setStatus("unavailable");
        });
    }

    try {
      worker = new Worker(new URL("../workers/aura-features.worker.ts", import.meta.url), { type: "module" });
    } catch {
      startMainThreadFallback();
      return () => {
        cancelled = true;
        clearTick();
      };
    }

    worker.addEventListener("message", (event: MessageEvent<AuraFeaturesWorkerResponse>) => {
      const message = event.data;
      if (message.type === "ready") {
        if (cancelled) return;
        readyRef.current = true;
        setStatus("ready");
        intervalId = setInterval(() => void captureTickWorker(), CAPTURE_INTERVAL_MS);
      } else if (message.type === "result") {
        handleSample(message.sample);
      } else if (message.type === "error") {
        if (readyRef.current) {
          busyRef.current = false;
        } else {
          startMainThreadFallback();
        }
      }
    });

    worker.addEventListener("error", () => {
      if (!readyRef.current) startMainThreadFallback();
    });

    return () => {
      cancelled = true;
      clearTick();
      worker?.postMessage({ type: "dispose" } satisfies AuraFeaturesWorkerRequest);
    };
  }, [videoRef]);

  return { status, metrics };
}
