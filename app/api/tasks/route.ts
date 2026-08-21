import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, reward: true, adNetwork: true, adFormat: true, cooldownSec: true, dailyLimit: true },
  });

  return NextResponse.json({ tasks });
}
