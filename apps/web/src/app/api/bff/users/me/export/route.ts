import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  return proxyJson(session, request, { method: 'GET', apiPath: '/users/me/export' });
}
