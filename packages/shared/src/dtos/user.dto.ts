import { z } from 'zod';

import { RoleSchema } from '../enums/role.enum.js';

export const UserSchema = z.object({
  id: z.uuid(),
  // .max(254): limite prático de e-mail (RFC 5321) — todo outro campo de
  // texto livre deste schema set já tem limite, e-mail alimenta uma rota
  // pública (POST /auth/register) com throttle leve.
  // .toLowerCase(): e-mail é case-insensitive por convenção de todo
  // provedor real; sem isso, "a@x.com" e "A@x.com" seriam contas
  // diferentes (mesmo valor de fato, unique constraint do Postgres não
  // ajuda porque é case-sensitive). Roda depois da validação de formato
  // (maiúsculas não afetam validade), então nunca rejeita um e-mail válido.
  email: z.email().max(254).toLowerCase(),
  displayName: z.string().min(1).max(32),
  // protocol restrito a http(s): sem isso, z.url() aceita qualquer scheme
  // (javascript:, data:, vbscript:...) — hoje só renderizado num <img src>
  // no próprio perfil (navegadores não executam esses schemes ali), mas é
  // um valor armazenado sem allowlist, então vira XSS/SSRF real assim que
  // qualquer feature futura usar esse valor num <a href>/fetch.
  avatarUrl: z.url({ protocol: /^https?$/ }).nullable(),
  role: RoleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
