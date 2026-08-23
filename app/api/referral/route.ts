import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

const MILESTONES = [
  { rank: 3, bonus: 1000 },
  { rank: 6, bonus: 2000 },
  { rank: 15, bonus: 5000 },
];
const COMMISSION_MIN_RANK = 16;
const COMMISSION_MAX_RANK = 20;

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { telegramId: String(verified.id) } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const [totalInvited, successfulInvited, commissionEligibleCount, earnings] = await Promise.all([
    prisma.user.count({ where: { referredById: user.id } }),
    prisma.user.count({ where: { referredById: user.id, referralCountedAt: { not: null } } }),
    prisma.user.count({
      where: { referredById: user.id, referralRank: { gte: COMMISSION_MIN_RANK, lte: COMMISSION_MAX_RANK } },
    }),
    prisma.referralEarning.groupBy({
      by: ["type"],
      where: { referrerId: user.id },
      _sum: { amount: true },
    }),
  ]);

  const totalMilestoneEarnings = earnings.find((e) => e.type === "MILESTONE")?._sum.amount || 0;
  const totalCommissionEarnings = earnings.find((e) => e.type === "COMMISSION")?._sum.amount || 0;

  const milestones = MILESTONES.map((m) => ({ ...m, achieved: successfulInvited >= m.rank }));

  const inactiveCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isLocked =
    commissionEligibleCount > 0 &&
    (!user.lastTaskCompletedAt || user.lastTaskCompletedAt.getTime() < inactiveCutoff);

  return NextResponse.json({
    referralCode: user.referralCode,
    totalInvited,
    successfulInvited,
    milestones,
    commissionEligibleCount,
    commissionSlotsMax: COMMISSION_MAX_RANK - COMMISSION_MIN_RANK + 1,
    totalMilestoneEarnings,
    totalCommissionEarnings,
    isLocked,
    lastTaskCompletedAt: user.lastTaskCompletedAt,
  });
}
