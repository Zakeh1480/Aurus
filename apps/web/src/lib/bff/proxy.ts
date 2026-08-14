import { AVATAR_MAX_FILE_SIZE_BYTES } from '@aurafarming/shared';
import type { IronSession } from 'iron-session';
import { NextResponse, type NextRequest } from 'next/server';

import { getApiInternalUrl, getBffSharedSecret } from '../env';
import { resolveClientIp } from './client-ip';
import { ensureFreshAccessToken } from './refresh';
import type { BffSessionData } from './session';

type ProxyJsonOptions = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  apiPath: string;
  requireSession?: boolean;
  body?: unknown;
};

export function unauthenticatedJson(): NextResponse {
  return NextResponse.json({ message: 'Sessão inválida ou expirada.' }, { status: 401 });
}

async function toNextResponse(response: Response): Promise<NextResponse> {
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const raw = await response.json().catch(() => undefined);
  return NextResponse.json(raw, { status: response.status });
}

function buildJsonHeaders(
  hasBody: boolean,
  accessToken: string | undefined,
  clientIp: string | undefined,
): HeadersInit {
  const headers: Record<string, string> = { 'x-bff-secret': getBffSharedSecret() };
  if (hasBody) {
    headers['content-type'] = 'application/json';
  }
  if (accessToken) {
    headers['authorization'] = `Bearer ${accessToken}`;
  }
  if (clientIp) {
    headers['x-forwarded-for'] = clientIp;
  }
  return headers;
}

export async function proxyJson(
  session: IronSession<BffSessionData> | null,
  request: Request,
  options: ProxyJsonOptions,
): Promise<NextResponse> {
  const requireSession = options.requireSession ?? true;
  const clientIp = resolveClientIp(request);
  let accessToken: string | undefined;

  if (requireSession) {
    if (!session?.refreshToken) {
      return unauthenticatedJson();
    }
    try {
      accessToken = await ensureFreshAccessToken(session, request);
    } catch {
      return unauthenticatedJson();
    }
  }

  const forward = () =>
    fetch(`${getApiInternalUrl()}${options.apiPath}`, {
      method: options.method,
      headers: buildJsonHeaders(options.body !== undefined, accessToken, clientIp),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let response = await forward();

  if (response.status === 401 && requireSession && session) {
    try {
      accessToken = await ensureFreshAccessToken(session, request, { force: true });
    } catch {
      return unauthenticatedJson();
    }
    response = await forward();
  }

  return toNextResponse(response);
}

export async function proxyMultipart(
  session: IronSession<BffSessionData> | null,
  request: NextRequest,
  apiPath: string,
): Promise<NextResponse> {
  if (!session?.refreshToken) {
    return unauthenticatedJson();
  }

  let accessToken: string;
  try {
    accessToken = await ensureFreshAccessToken(session, request);
  } catch {
    return unauthenticatedJson();
  }

  const contentType = request.headers.get('content-type');
  if (!contentType?.startsWith('multipart/form-data')) {
    return NextResponse.json({ message: 'Content-Type inválido.' }, { status: 400 });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > AVATAR_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { message: 'Arquivo excede o tamanho máximo permitido.' },
      { status: 413 },
    );
  }

  const clientIp = resolveClientIp(request);
  const upstream = await fetch(`${getApiInternalUrl()}${apiPath}`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      authorization: `Bearer ${accessToken}`,
      'x-bff-secret': getBffSharedSecret(),
      ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
    },
    body: request.body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  return toNextResponse(upstream);
}
