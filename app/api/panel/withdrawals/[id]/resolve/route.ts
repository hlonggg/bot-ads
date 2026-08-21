import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";
import { bot } from "@/lib/bot";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const admin = verifyAdminInitData(body.initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const action = body.action as "approve" | "reject";
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: params.id }, include: { user: true } });
  if (!withdrawal || withdrawal.status !== "PENDING") {
    return NextResponse.json({ error: "not_found_or_resolved" }, { status: 404 });
  }

  if (action === "approve") {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: withdrawal.userId },
        data: { pendingBalance: { decrement: withdrawal.amount } },
      }),
      prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "APPROVED", resolvedAt: new Date() },
      }),
    ]);
  } else {
    // reject: refund back to spendable balance
    await prisma.$transaction([
      prisma.user.update({
        where: { id: withdrawal.userId },
        data: {
          pendingBalance: { decrement: withdrawal.amount },
          balance: { increment: withdrawal.amount },
        },
      }),
      prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: "REJECTED", resolvedAt: new Date() },
      }),
    ]);
  }

  // Best-effort notify user
  try {
    await bot.telegram.sendMessage(
      withdrawal.user.telegramId,
      action === "approve"
        ? `✅ Lệnh rút ${withdrawal.amount.toLocaleString("vi-VN")}đ đã được duyệt.`
        : `❌ Lệnh rút ${withdrawal.amount.toLocaleString("vi-VN")}đ đã bị từ chối. Số dư đã được hoàn lại.`
    );
  } catch (e) {
    console.error("[panel] notify user failed", e);
  }

  return NextResponse.json({ ok: true });
}
