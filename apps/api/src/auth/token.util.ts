import { createHash, randomBytes } from "node:crypto";

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * SHA-256 é adequado aqui porque o refresh token já é um segredo de alta
 * entropia gerado por nós (não uma senha escolhida por humano), e o schema
 * exige lookup determinístico por igualdade (`tokenHash @unique`) — algo
 * incompatível com o salt aleatório do Argon2. Argon2 fica reservado para
 * senhas.
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
