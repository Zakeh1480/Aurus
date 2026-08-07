/**
 * Bootstrap de moderador — lista de e-mails promovidos a `role: "moderator"`
 * na subida da API (RoleBootstrapService). Sem UI de promoção no MVP; ler em
 * runtime (nunca em escopo de módulo), mesma convenção dos demais `*.constants.ts`.
 */
export function getModerationBootstrapEmails(): string[] {
  // Lowercase — UserSchema.email (packages/shared) normaliza todo e-mail
  // pra lowercase antes de persistir, então o match aqui precisa da mesma
  // normalização pra não deixar de promover por divergência de case.
  return (process.env['MODERATION_BOOTSTRAP_EMAILS'] ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}
