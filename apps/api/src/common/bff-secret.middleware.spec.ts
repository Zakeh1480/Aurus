import type { NextFunction, Request, Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { bffSecretMiddleware, isValidBffSecret } from './bff-secret.middleware';

function fakeReq(path: string, headers: Record<string, string> = {}): Request {
  return {
    path,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

function fakeRes(): Response & {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res = {} as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('isValidBffSecret', () => {
  it('rejeita quando o candidato é undefined', () => {
    expect(isValidBffSecret(undefined, 'segredo')).toBe(false);
  });

  it('rejeita quando o candidato difere do esperado', () => {
    expect(isValidBffSecret('errado', 'segredo')).toBe(false);
  });

  it('aceita quando o candidato bate exatamente com o esperado', () => {
    expect(isValidBffSecret('segredo', 'segredo')).toBe(true);
  });
});

describe('bffSecretMiddleware', () => {
  afterEach(() => {
    delete process.env['BFF_SHARED_SECRET'];
  });

  it('deixa passar /health sem exigir o header, mesmo sem BFF_SHARED_SECRET configurado', () => {
    const req = fakeReq('/health');
    const res = fakeRes();
    const next = vi.fn();

    bffSecretMiddleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('deixa passar /livekit/webhook sem exigir o header', () => {
    const req = fakeReq('/livekit/webhook');
    const res = fakeRes();
    const next = vi.fn();

    bffSecretMiddleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responde 401 sem o header X-BFF-Secret numa rota não isenta', () => {
    process.env['BFF_SHARED_SECRET'] = 'segredo-real';
    const req = fakeReq('/users/me');
    const res = fakeRes();
    const next = vi.fn();

    bffSecretMiddleware(req, res, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 401 com o header errado', () => {
    process.env['BFF_SHARED_SECRET'] = 'segredo-real';
    const req = fakeReq('/users/me', { 'x-bff-secret': 'segredo-errado' });
    const res = fakeRes();
    const next = vi.fn();

    bffSecretMiddleware(req, res, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('chama next() com o header correto', () => {
    process.env['BFF_SHARED_SECRET'] = 'segredo-real';
    const req = fakeReq('/users/me', { 'x-bff-secret': 'segredo-real' });
    const res = fakeRes();
    const next = vi.fn();

    bffSecretMiddleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('lança (fail-closed) numa rota não isenta quando BFF_SHARED_SECRET não está definido', () => {
    delete process.env['BFF_SHARED_SECRET'];
    const req = fakeReq('/users/me', { 'x-bff-secret': 'qualquer-coisa' });
    const res = fakeRes();
    const next = vi.fn();

    expect(() => bffSecretMiddleware(req, res, next as NextFunction)).toThrow();
  });
});
