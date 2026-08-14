import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  return proxyJson(session, { method: 'GET', apiPath: '/users/me/export' });
}
