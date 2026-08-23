import { Telegraf, Markup } from "telegraf";
import { prisma } from "./prisma";
import { isAdmin } from "./admin";
import { generateReferralCode } from "./referral";

const BOT_TOKEN = process.env.BOT_TOKEN as string;
const APP_URL = process.env.APP_URL as string; // e.g. https://your-app.up.railway.app

if (!BOT_TOKEN) {
  // Don't throw at import time in build environments without env vars yet
  console.warn("[bot] BOT_TOKEN is not set");
}

export const bot = new Telegraf(BOT_TOKEN || "placeholder");

bot.start(async (ctx) => {
  const tgId = String(ctx.from.id);

  // Deep link kiểu https://t.me/<bot>?start=ref_<code> -> Telegraf tự bóc phần
  // sau "start=" vào ctx.startPayload. Chỉ áp dụng cho user MỚI (create), user
  // đã tồn tại giữ nguyên referredById cũ, không ghi đè dù bấm lại link ref khác.
  let referredById: string | undefined;
  const payload = ctx.startPayload || "";
  if (payload.startsWith("ref_")) {
    const code = payload.slice(4);
    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (referrer && referrer.telegramId !== tgId) referredById = referrer.id;
  }

  const existing = await prisma.user.findUnique({ where: { telegramId: tgId } });

  await prisma.user.upsert({
    where: { telegramId: tgId },
    update: {
      lastSeenAt: new Date(),
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    },
    create: {
      telegramId: tgId,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      referralCode: generateReferralCode(),
      referredById: !existing ? referredById : undefined,
    },
  });

  await ctx.reply(
    "Chào mừng bạn 👋\nMở ứng dụng bên dưới để bắt đầu kiếm tiền.",
    Markup.inlineKeyboard([
      Markup.button.webApp("💰 Mở ứng dụng", `${APP_URL}/task`),
    ])
  );
});

bot.command("panel", async (ctx) => {
  const tgId = String(ctx.from.id);
  if (!isAdmin(tgId)) {
    return; // silently ignore — don't reveal panel exists to non-admins
  }
  await ctx.reply(
    "Trang quản trị:",
    Markup.inlineKeyboard([Markup.button.webApp("🛠 Mở Admin Panel", `${APP_URL}/panel`)])
  );
});
