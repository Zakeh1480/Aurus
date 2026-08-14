export class InvalidJsonBodyError extends Error {}

export async function parseJsonBody<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new InvalidJsonBodyError();
  }
}

export function invalidJsonBodyResponse(): Response {
  return Response.json({ message: 'Corpo da requisição não é JSON válido.' }, { status: 400 });
}
