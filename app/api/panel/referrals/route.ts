import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [totalPaidAgg, topReferrers] = await Promise.all([
    prisma.referralEarning.aggregate({ _sum: { amount: true } }),
    prisma.user.findMany({
      where: { referrals: { some: {} } },
      select: {
        id: true,
        username: true,
        firstName: true,
        telegramId: true,
        referralLocked: true,
        lastTaskCompletedAt: true,
        _count: { select: { referrals: true } },
        referralEarnings: { select: { amount: true, type: true } },
      },
      take: 50,
    }),
  ]);

  const rows = topReferrers
    .map((u) => ({
      id: u.id,
      username: u.username,
      firstName: u.firstName,
      telegramId: u.telegramId,
      referralLocked: u.referralLocked,
      lastTaskCompletedAt: u.lastTaskCompletedAt,
      totalInvited: u._count.referrals,
      totalEarned: u.referralEarnings.reduce((s, e) => s + e.amount, 0),
    }))
    .sort((a, b) => b.totalEarned - a.totalEarned);

  return NextResponse.json({
    totalPaidOut: totalPaidAgg._sum.amount || 0,
    referrers: rows,
  });
}
