import type { Prisma } from "@prisma/client";

/**
 * "Ban em vigor agora": liftedAt nulo e (sem expiresAt ou expiresAt no
 * futuro). Função (não constante) porque usa `new Date()` — deve ser chamada
 * em runtime, nunca em escopo de módulo. Única definição de "banido" no
 * sistema — reusada em AuthService.login/refresh, JwtStrategy.validate e
 * WsAuthService.authenticate para nunca divergir (Prompt 13).
 */
export function activeBanWhere(): Prisma.BanWhereInput {
  return { liftedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}
