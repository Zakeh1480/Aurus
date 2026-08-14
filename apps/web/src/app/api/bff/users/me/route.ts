import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

export async function DELETE() {
  const session = await getSession();
  const response = await proxyJson(session, { method: 'DELETE', apiPath: '/users/me' });
  if (response.status >= 200 && response.status < 300) {
    session.destroy();
  }
  return response;
}
