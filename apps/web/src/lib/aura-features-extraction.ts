/**
 * Heurísticas puras que transformam landmarks/blendshapes do MediaPipe
 * FaceLandmarker nas 5 métricas de AuraFeatures (0-1). Não há "gabarito" —
 * services/ai só pontua o vetor que recebe, sem saber como foi extraído
 * (services/ai/CONTRACT.md) — então estas são heurísticas geométricas
 * simples e documentadas, não um modelo treinado. Ficam separadas da
 * integração real com o MediaPipe (worker) para serem testáveis sem
 * depender de WASM/DOM.
 *
 * Índices de landmark seguem a topologia pública do MediaPipe Face Mesh
 * (478 pontos): 1 = ponta do nariz, 33 = canto externo do olho direito do
 * sujeito, 263 = canto externo do olho esquerdo do sujeito.
 */

export type NormalizedPoint = { x: number; y: number };

export type FaceDetectionSample = {
  /** Indexado como MediaPipe FaceLandmarker; só os índices citados acima são usados. */
  landmarks: NormalizedPoint[];
  /** categoryName -> score, de FaceLandmarkerResult.faceBlendshapes[0].categories. */
  blendshapes: Record<string, number>;
};

export type AuraMetricValues = {
  posture: number;
  eyeContact: number;
  expression: number;
  presence: number;
  movement: number;
};

const LANDMARK_NOSE_TIP = 1;
const LANDMARK_RIGHT_EYE_OUTER = 33;
const LANDMARK_LEFT_EYE_OUTER = 263;

/** Além deste ângulo (rad) de inclinação da linha entre os olhos, postura satura em 0. */
const MAX_POSTURE_ROLL_RAD = 0.5;
/** Além desta assimetria nariz→olhos, contato visual satura em 0. */
const MAX_EYE_CONTACT_ASYMMETRY = 0.6;
/** Deslocamento (fração da largura do frame) da ponta do nariz que satura o score de movimento em 1. */
const MAX_MOVEMENT_DELTA = 0.15;

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function distance(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function landmarkAt(landmarks: NormalizedPoint[], index: number): NormalizedPoint | undefined {
  return landmarks[index];
}

/** 1 se um rosto foi detectado no frame, 0 caso contrário. */
export function computePresence(sample: FaceDetectionSample | null): number {
  return sample && sample.landmarks.length > 0 ? 1 : 0;
}

/**
 * Proxy de yaw: quando o rosto encara a câmera, as distâncias nariz→cada
 * canto de olho ficam próximas; virar a cabeça para um dos lados encolhe
 * uma delas bem mais que a outra.
 */
export function computeEyeContact(sample: FaceDetectionSample | null): number {
  if (!sample) return 0;
  const nose = landmarkAt(sample.landmarks, LANDMARK_NOSE_TIP);
  const rightEye = landmarkAt(sample.landmarks, LANDMARK_RIGHT_EYE_OUTER);
  const leftEye = landmarkAt(sample.landmarks, LANDMARK_LEFT_EYE_OUTER);
  if (!nose || !rightEye || !leftEye) return 0;

  const distRight = distance(nose, rightEye);
  const distLeft = distance(nose, leftEye);
  const total = distRight + distLeft;
  if (total === 0) return 0;

  const asymmetry = Math.abs(distRight - distLeft) / total;
  return clamp01(1 - asymmetry / MAX_EYE_CONTACT_ASYMMETRY);
}

function blendshapeScore(blendshapes: Record<string, number>, name: string): number {
  return blendshapes[name] ?? 0;
}

/** Agrega blendshapes de sorriso e sobrancelha num score único de expressividade. */
export function computeExpression(sample: FaceDetectionSample | null): number {
  if (!sample) return 0;
  const smile = (blendshapeScore(sample.blendshapes, "mouthSmileLeft") + blendshapeScore(sample.blendshapes, "mouthSmileRight")) / 2;
  const brow =
    (blendshapeScore(sample.blendshapes, "browInnerUp") +
      blendshapeScore(sample.blendshapes, "browOuterUpLeft") +
      blendshapeScore(sample.blendshapes, "browOuterUpRight")) /
    3;
  return clamp01(0.7 * smile + 0.3 * brow);
}

/**
 * Proxy de postura: inclinação (roll) da linha entre os cantos externos dos
 * olhos, combinada com a posição vertical da ponta do nariz no frame (rosto
 * bem enquadrado fica perto do centro vertical).
 */
export function computePosture(sample: FaceDetectionSample | null): number {
  if (!sample) return 0;
  const nose = landmarkAt(sample.landmarks, LANDMARK_NOSE_TIP);
  const rightEye = landmarkAt(sample.landmarks, LANDMARK_RIGHT_EYE_OUTER);
  const leftEye = landmarkAt(sample.landmarks, LANDMARK_LEFT_EYE_OUTER);
  if (!nose || !rightEye || !leftEye) return 0;

  const roll = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);
  const rollScore = clamp01(1 - Math.abs(roll) / MAX_POSTURE_ROLL_RAD);

  const verticalOffset = Math.abs(nose.y - 0.5);
  const verticalScore = clamp01(1 - verticalOffset / 0.5);

  return (rollScore + verticalScore) / 2;
}

/**
 * Proxy de movimento: deslocamento frame-a-frame da ponta do nariz. Sem
 * amostra anterior (primeiro frame da sessão), não há como medir — 0.
 */
export function computeMovement(
  current: FaceDetectionSample | null,
  previous: FaceDetectionSample | null,
): number {
  if (!current || !previous) return 0;
  const currentNose = landmarkAt(current.landmarks, LANDMARK_NOSE_TIP);
  const previousNose = landmarkAt(previous.landmarks, LANDMARK_NOSE_TIP);
  if (!currentNose || !previousNose) return 0;

  const delta = distance(currentNose, previousNose);
  return clamp01(delta / MAX_MOVEMENT_DELTA);
}

export function extractAuraMetrics(
  current: FaceDetectionSample | null,
  previous: FaceDetectionSample | null,
): AuraMetricValues {
  return {
    posture: computePosture(current),
    eyeContact: computeEyeContact(current),
    expression: computeExpression(current),
    presence: computePresence(current),
    movement: computeMovement(current, previous),
  };
}
