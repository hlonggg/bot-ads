import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

async function getSetting(key: string, fallback: string) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { initData, amount, bankAccountName, bankAccountNumber, bankName } = body;

  const verified = verifyInitData(initData || "", process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const amountNum = Number(amount);
  if (!amountNum || amountNum <= 0 || !bankAccountName || !bankAccountNumber || !bankName) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const minWithdraw = Number(await getSetting("minWithdraw", "50000"));
  if (amountNum < minWithdraw) {
    return NextResponse.json({ error: "below_min", minWithdraw }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { telegramId: String(verified.id) } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  if (user.balance < amountNum) {
    return NextResponse.json({ error: "insufficient_balance" }, { status: 400 });
  }

  // Move funds balance -> pendingBalance atomically so a second withdraw request
  // can't be created against the same funds while this one is awaiting review.
  const [, withdrawal] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { decrement: amountNum },
        pendingBalance: { increment: amountNum },
        bankAccountName,
        bankAccountNumber,
        bankName,
      },
    }),
    prisma.withdrawal.create({
      data: { userId: user.id, amount: amountNum, bankAccountName, bankAccountNumber, bankName, status: "PENDING" },
    }),
  ]);

  return NextResponse.json({ ok: true, withdrawal });
}
