import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { telegramId: String(verified.id) },
    select: {
      telegramId: true,
      firstName: true,
      username: true,
      balance: true,
      pendingBalance: true,
      bankAccountName: true,
      bankAccountNumber: true,
      bankName: true,
    },
  });

  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  return NextResponse.json({ user });
}
