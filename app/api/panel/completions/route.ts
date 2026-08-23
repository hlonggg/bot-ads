import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

// Log các lượt hoàn thành nhiệm vụ (mọi network) — dùng để đối chiếu Monetag có
// thực sự gọi postback về đúng không, và số tiền tính ra có hợp lý không.
export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") || undefined; // CONFIRMED | PENDING | REJECTED
  const taskId = req.nextUrl.searchParams.get("taskId") || undefined;

  const completions = await prisma.taskCompletion.findMany({
    where: {
      status: status ? (status as any) : undefined,
      taskId: taskId || undefined,
    },
    include: {
      task: { select: { name: true, adNetwork: true } },
      user: { select: { username: true, firstName: true, telegramId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ completions });
}
