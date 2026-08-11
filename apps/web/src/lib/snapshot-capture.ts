import { computeDownscaleDimensions } from './snapshot-resize';

const MAX_SNAPSHOT_WIDTH = 320;
const JPEG_QUALITY = 0.6;

function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function captureSnapshotBase64(video: HTMLVideoElement): Promise<string> {
  const { width, height } = computeDownscaleDimensions(
    { width: video.videoWidth, height: video.videoHeight },
    MAX_SNAPSHOT_WIDTH,
  );
  if (width === 0 || height === 0) {
    throw new Error('Vídeo sem dimensões válidas para capturar snapshot.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D indisponível para capturar snapshot.');
  }
  context.drawImage(video, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error('Falha ao gerar snapshot JPEG.');
  }

  return bufferToBase64(await blob.arrayBuffer());
}
