/**
 * Bootstrap de moderador — lista de e-mails promovidos a `role: "moderator"`
 * na subida da API (RoleBootstrapService). Sem UI de promoção no MVP; ler em
 * runtime (nunca em escopo de módulo), mesma convenção dos demais `*.constants.ts`.
 */
export function getModerationBootstrapEmails(): string[] {
  // Match exato (sem lowercase) — mesma convenção de AuthService.login, que
  // também não normaliza case do e-mail armazenado.
  return (process.env["MODERATION_BOOTSTRAP_EMAILS"] ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}
