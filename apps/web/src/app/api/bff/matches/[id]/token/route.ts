import { proxyJson } from '@/lib/bff/proxy';
import { getSession } from '@/lib/bff/session';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getSession();
  return proxyJson(session, request, { method: 'POST', apiPath: `/matches/${id}/token` });
}
