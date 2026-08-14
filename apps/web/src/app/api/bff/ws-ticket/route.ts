import { getSession } from '@/lib/bff/session';
import { proxyJson } from '@/lib/bff/proxy';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  return proxyJson(session, request, { method: 'POST', apiPath: '/ws/ticket' });
}
