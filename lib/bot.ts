import { Telegraf, Markup } from "telegraf";
import { prisma } from "./prisma";
import { isAdmin } from "./admin";

const BOT_TOKEN = process.env.BOT_TOKEN as string;
const APP_URL = process.env.APP_URL as string; // e.g. https://your-app.up.railway.app

if (!BOT_TOKEN) {
  // Don't throw at import time in build environments without env vars yet
  console.warn("[bot] BOT_TOKEN is not set");
}

export const bot = new Telegraf(BOT_TOKEN || "placeholder");

bot.start(async (ctx) => {
  const tgId = String(ctx.from.id);

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
