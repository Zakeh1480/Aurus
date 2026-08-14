export function resolveClientIp(request: Request): string | undefined {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) {
    return undefined;
  }
  const first = forwardedFor.split(',')[0]?.trim();
  return first || undefined;
}
