import crypto from "crypto";

/**
 * Verifies the `initData` string sent by the Telegram WebApp client.
 * This is the ONLY trustworthy way to know which Telegram user is calling
 * an API route from inside the Mini App — never trust a telegramId passed
 * directly in a request body, it can be spoofed by anyone hitting the API.
 *
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export interface VerifiedTelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export function verifyInitData(
  initData: string,
  botToken: string
): VerifiedTelegramUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckArr: string[] = [];
  params.forEach((value, key) => dataCheckArr.push(`${key}=${value}`));
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  // Optional: reject stale initData (older than 24h) to limit replay window
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 60 * 60 * 24) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw) as VerifiedTelegramUser;
  } catch {
    return null;
  }
}
