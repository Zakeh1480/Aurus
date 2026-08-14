import { getSession } from '@/lib/bff/session';
import { proxyJson } from '@/lib/bff/proxy';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  return proxyJson(session, { method: 'POST', apiPath: '/ws/ticket' });
}
