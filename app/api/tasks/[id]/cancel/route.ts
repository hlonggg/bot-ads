import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { initData, requestId } = body;

  const verified = verifyInitData(initData || "", process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requestId) return NextResponse.json({ error: "missing_requestId" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { telegramId: String(verified.id) } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const completion = await prisma.taskCompletion.findUnique({ where: { requestId } });
  // Only the owning user can cancel their own attempt, and only while still PENDING —
  // if a postback already confirmed it in the meantime, we must not overwrite that.
  if (!completion || completion.userId !== user.id || completion.taskId !== params.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (completion.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyResolved: true });
  }

  await prisma.taskCompletion.update({
    where: { id: completion.id },
    data: { status: "REJECTED" },
  });

  return NextResponse.json({ ok: true });
}
