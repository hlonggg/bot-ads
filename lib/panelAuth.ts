import { verifyInitData } from "./verifyInitData";
import { isAdmin } from "./admin";

export function verifyAdminInitData(initData: string) {
  const verified = verifyInitData(initData || "", process.env.BOT_TOKEN || "");
  if (!verified) return null;
  if (!isAdmin(verified.id)) return null;
  return verified;
}
