'use client';

import { useQuery } from '@tanstack/react-query';
import type { User } from '@aurafarming/shared';

import type { AuthStatus } from '@/components/providers/auth-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { usersApi } from '@/lib/api-client';
import { isCameraConsentGranted } from '@/lib/consent';
import { consentStatusQueryKey } from '@/lib/query-keys';

export type CameraConsentState = 'unknown' | 'loading' | 'granted' | 'required';

export type SessionState = {
  status: AuthStatus;
  user: User | null;
  cameraConsent: CameraConsentState;
  canEnterQueue: boolean;
};

export function useSession(): SessionState {
  const { status, user } = useAuth();

  const consentQuery = useQuery({
    queryKey: consentStatusQueryKey,
    queryFn: usersApi.consentStatus,
    enabled: status === 'authenticated',
    staleTime: 60_000,
  });

  const cameraConsent: CameraConsentState =
    status !== 'authenticated'
      ? 'unknown'
      : consentQuery.isPending
        ? 'loading'
        : isCameraConsentGranted(consentQuery.data ?? [])
          ? 'granted'
          : 'required';

  return {
    status,
    user,
    cameraConsent,
    canEnterQueue: status === 'authenticated' && cameraConsent === 'granted',
  };
}
