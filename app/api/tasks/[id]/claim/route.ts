import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";
import crypto from "crypto";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const initData = body.initData || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: params.id } });
  if (!task || !task.isActive) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { telegramId: String(verified.id) } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // Cooldown check — ignore REJECTED attempts (ad failed/skipped client-side via /cancel),
  // otherwise a user gets punished with a cooldown wait for an ad that never actually played.
  if (task.cooldownSec > 0) {
    const last = await prisma.taskCompletion.findFirst({
      where: { taskId: task.id, userId: user.id, status: { in: ["CONFIRMED", "PENDING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (last) {
      const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
      if (elapsed < task.cooldownSec) {
        return NextResponse.json(
          { error: "cooldown", retryAfterSec: Math.ceil(task.cooldownSec - elapsed) },
          { status: 429 }
        );
      }
    }
  } else {
    // one-time task — reject if already confirmed once
    const done = await prisma.taskCompletion.findFirst({
      where: { taskId: task.id, userId: user.id, status: { in: ["CONFIRMED", "PENDING"] } },
    });
    if (done) return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  // Daily limit check — same reasoning, REJECTED attempts don't count against the quota
  if (task.dailyLimit) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const countToday = await prisma.taskCompletion.count({
      where: {
        taskId: task.id,
        userId: user.id,
        createdAt: { gte: startOfDay },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
    });
    if (countToday >= task.dailyLimit) {
      return NextResponse.json({ error: "daily_limit_reached" }, { status: 429 });
    }
  }

  const requestId = crypto.randomBytes(16).toString("hex");
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

  await prisma.taskCompletion.create({
    data: {
      taskId: task.id,
      userId: user.id,
      reward: task.reward,
      requestId,
      ip: ip || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    requestId,
    adNetwork: task.adNetwork,
    adFormat: task.adFormat,
    // For "monetag" tasks the client uses the globally-loaded SDK + show_<mainZoneId>(),
    // not a per-task script — the SDK docs explicitly warn against per-placement
    // sub-zone scripts and multiple SDK tags on one page. adScript is only relevant
    // for non-monetag networks that don't provide a promise-based SDK.
    adScript: task.adNetwork === "monetag" ? null : task.adScript,
  });
}
