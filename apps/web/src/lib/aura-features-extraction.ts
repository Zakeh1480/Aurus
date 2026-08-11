export type NormalizedPoint = { x: number; y: number };

export type FaceDetectionSample = {
  landmarks: NormalizedPoint[];

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

const MAX_POSTURE_ROLL_RAD = 0.5;

const MAX_EYE_CONTACT_ASYMMETRY = 0.6;

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

export function computePresence(sample: FaceDetectionSample | null): number {
  return sample && sample.landmarks.length > 0 ? 1 : 0;
}

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

export function computeExpression(sample: FaceDetectionSample | null): number {
  if (!sample) return 0;
  const smile =
    (blendshapeScore(sample.blendshapes, 'mouthSmileLeft') +
      blendshapeScore(sample.blendshapes, 'mouthSmileRight')) /
    2;
  const brow =
    (blendshapeScore(sample.blendshapes, 'browInnerUp') +
      blendshapeScore(sample.blendshapes, 'browOuterUpLeft') +
      blendshapeScore(sample.blendshapes, 'browOuterUpRight')) /
    3;
  return clamp01(0.7 * smile + 0.3 * brow);
}

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
