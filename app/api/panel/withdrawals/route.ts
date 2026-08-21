import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { username: true, firstName: true, telegramId: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ withdrawals });
}
