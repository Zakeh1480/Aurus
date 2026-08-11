'use client';

import * as React from 'react';
import {
  buildFeaturesSigningPayload,
  buildVerifyResponseSigningPayload,
  type AuraFeatures,
  type MatchVerifyChallengePayload,
} from '@aurafarming/shared';

import { useAuth } from '@/components/providers/auth-provider';
import { useSocket } from '@/components/providers/socket-provider';
import { ApiError, matchesApi } from '@/lib/api-client';
import type { AuraMetricValues } from '@/lib/aura-features-extraction';
import { hmacSha256Hex } from '@/lib/hmac-browser';
import {
  initialMatchRoomState,
  reduceMatchRoomState,
  type MatchRoomErrorKind,
  type MatchRoomState,
} from '@/lib/match-room-reducer';
import { captureSnapshotBase64 } from '@/lib/snapshot-capture';

import { useAuraFeatures, type AuraFeaturesStatus } from './use-aura-features';
import type { LivekitRoomStatus } from './use-livekit-room';

const FEATURE_SEND_INTERVAL_MS = 1000;

const RESULT_TIMEOUT_MS = 12_000;

const CHALLENGE_SAFETY_MARGIN_MS = 2_000;

const ZERO_METRICS: AuraMetricValues = {
  posture: 0,
  eyeContact: 0,
  expression: 0,
  presence: 0,
  movement: 0,
};

export type UseMatchRoomResult = {
  state: MatchRoomState;
  auraStatus: AuraFeaturesStatus;
  ownMetrics: AuraMetricValues | null;
  forfeit: () => void;
};

function mapApiErrorToErrorKind(error: unknown): MatchRoomErrorKind {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'not-found';
    if (error.status === 403) return 'forbidden';
    if (error.status === 409) return 'not-active';
  }
  return 'connection-failed';
}

export function useMatchRoom(
  matchId: string,
  livekitStatus: LivekitRoomStatus,
  videoRef: React.RefObject<HTMLVideoElement | null>,
): UseMatchRoomResult {
  const { user } = useAuth();
  const socket = useSocket();
  const { status: auraStatus, metrics } = useAuraFeatures(videoRef);

  const [state, dispatch] = React.useReducer(reduceMatchRoomState, initialMatchRoomState);

  const secretRef = React.useRef<string | null>(null);
  const [secretStatus, setSecretStatus] = React.useState<'pending' | 'ready' | 'error'>('pending');
  const [secretErrorKind, setSecretErrorKind] =
    React.useState<MatchRoomErrorKind>('connection-failed');

  const metricsRef = React.useRef<AuraMetricValues | null>(null);
  React.useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  const statusRef = React.useRef(state.status);
  React.useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  React.useEffect(() => {
    let cancelled = false;
    matchesApi
      .getAntiCheatSecret(matchId)
      .then((response) => {
        if (cancelled) return;
        secretRef.current = response.sessionSecret;
        setSecretStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSecretErrorKind(mapApiErrorToErrorKind(error));
        setSecretStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  React.useEffect(() => {
    if (livekitStatus !== 'connecting' && livekitStatus !== 'connected') {
      dispatch({ type: 'CONNECTION_FAILED', kind: livekitStatus });
      return;
    }
    if (secretStatus === 'error') {
      dispatch({ type: 'CONNECTION_FAILED', kind: secretErrorKind });
      return;
    }
    if (livekitStatus === 'connected' && secretStatus === 'ready') {
      dispatch({ type: 'CONNECTED' });
    }
  }, [livekitStatus, secretStatus, secretErrorKind]);

  React.useEffect(() => {
    if (state.status !== 'ended-awaiting-result') return;
    const timeoutId = setTimeout(() => dispatch({ type: 'RESULT_TIMEOUT' }), RESULT_TIMEOUT_MS);
    return () => clearTimeout(timeoutId);
  }, [state.status]);

  React.useEffect(() => {
    if (!socket || !user) return;
    let sequence = Date.now();

    const intervalId = setInterval(() => {
      if (statusRef.current !== 'live') return;
      const secret = secretRef.current;
      const currentMetrics = metricsRef.current;
      if (!secret || !currentMetrics) return;

      void (async () => {
        const capturedAt = new Date().toISOString();
        const features: AuraFeatures = { ...currentMetrics, sequence: sequence++, capturedAt };
        const nonce = crypto.randomUUID();
        const canonical = buildFeaturesSigningPayload({
          matchId,
          userId: user.id,
          nonce,
          sequence: features.sequence,
          capturedAt,
        });
        const signature = await hmacSha256Hex(canonical, secret);
        socket.emit('match:features', { matchId, userId: user.id, features, nonce, signature });
      })();
    }, FEATURE_SEND_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [socket, user, matchId]);

  React.useEffect(() => {
    if (!socket || !user) return;

    async function respondToChallenge(payload: MatchVerifyChallengePayload): Promise<void> {
      const secret = secretRef.current;
      const video = videoRef.current;
      if (!secret || !video) return;
      if (Date.now() >= Date.parse(payload.expiresAt) - CHALLENGE_SAFETY_MARGIN_MS) return;

      const capturedAt = new Date().toISOString();
      const claimedFeatures: AuraFeatures = {
        ...(metricsRef.current ?? ZERO_METRICS),
        sequence: Date.now(),
        capturedAt,
      };

      let keyframeBase64: string;
      try {
        keyframeBase64 = await captureSnapshotBase64(video);
      } catch {
        return;
      }

      const canonical = buildVerifyResponseSigningPayload({
        matchId,
        userId: user!.id,
        challengeId: payload.challengeId,
        nonce: payload.nonce,
        capturedAt,
      });
      const signature = await hmacSha256Hex(canonical, secret);

      socket!.emit('match:verify-response', {
        matchId,
        userId: user!.id,
        challengeId: payload.challengeId,
        nonce: payload.nonce,
        capturedAt,
        keyframeBase64,
        claimedFeatures,
        signature,
      });
      dispatch({ type: 'VERIFY_CHALLENGE_ANSWERED', challengeId: payload.challengeId });
    }

    const offTick = socket.on('match:score-tick', (payload) => {
      if (payload.matchId !== matchId) return;
      dispatch({ type: 'SCORE_TICK', payload, selfUserId: user.id });
    });
    const offChallenge = socket.on('match:verify-challenge', (payload) => {
      if (payload.matchId !== matchId) return;
      dispatch({ type: 'VERIFY_CHALLENGE_RECEIVED', payload });
      void respondToChallenge(payload);
    });
    const offEnd = socket.on('match:end', (payload) => {
      if (payload.matchId !== matchId) return;
      dispatch({ type: 'MATCH_END', payload });
    });
    const offResult = socket.on('match:result', (payload) => {
      if (payload.matchId !== matchId) return;
      dispatch({ type: 'MATCH_RESULT', payload });
    });

    return () => {
      offTick();
      offChallenge();
      offEnd();
      offResult();
    };
  }, [socket, user, matchId, videoRef]);

  const forfeit = React.useCallback(() => {
    if (!socket || !user) return;
    socket.emit('match:forfeit', { matchId, userId: user.id });
  }, [socket, user, matchId]);

  return { state, auraStatus, ownMetrics: metrics, forfeit };
}
