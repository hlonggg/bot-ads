/**
 * ADMIN_IDS env var format: comma separated Telegram numeric ids
 * e.g. ADMIN_IDS=123456789,987654321
 */
export function getAdminIds(): string[] {
  return (process.env.ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdmin(telegramId: string | number | undefined | null): boolean {
  if (!telegramId) return false;
  return getAdminIds().includes(String(telegramId));
}
