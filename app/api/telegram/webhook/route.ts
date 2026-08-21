import { NextRequest, NextResponse } from "next/server";
import { bot } from "@/lib/bot";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    await bot.handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] error", err);
    // Always 200 to Telegram even on internal error, otherwise Telegram retries the same update in a loop
    return NextResponse.json({ ok: true });
  }
}

// Convenience GET to (re)register the webhook — call once after each deploy,
// or hit it manually: https://your-app.up.railway.app/api/telegram/webhook
export async function GET() {
  const APP_URL = process.env.APP_URL;
  if (!APP_URL) return NextResponse.json({ ok: false, error: "APP_URL not set" });
  await bot.telegram.setWebhook(`${APP_URL}/api/telegram/webhook`);
  return NextResponse.json({ ok: true, webhook: `${APP_URL}/api/telegram/webhook` });
}
