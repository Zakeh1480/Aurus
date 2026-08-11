export function getModerationBootstrapEmails(): string[] {
  return (process.env['MODERATION_BOOTSTRAP_EMAILS'] ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}
