import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";
import { bot } from "@/lib/bot";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = verifyAdminInitData(body.initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });

  const users = await prisma.user.findMany({ select: { telegramId: true } });

  let sent = 0;
  let failed = 0;

  // Send with small delay batches to respect Telegram rate limits (~30 msgs/sec)
  for (let i = 0; i < users.length; i++) {
    try {
      await bot.telegram.sendMessage(users[i].telegramId, text);
      sent++;
    } catch (e) {
      failed++; // user blocked the bot, or invalid chat — expected at scale, not fatal
    }
    if (i % 25 === 24) await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({ ok: true, sent, failed, total: users.length });
}
