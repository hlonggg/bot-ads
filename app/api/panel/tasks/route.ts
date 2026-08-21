import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = verifyAdminInitData(body.initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { name, reward, adScript, adNetwork, adFormat, zoneId, cooldownSec, dailyLimit, marginPercent } = body;
  const network = adNetwork || "custom";

  if (!name) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  // Monetag uses the global zone script configured in Settings — no per-task
  // script/zoneId required. Other networks must supply their own embed script.
  if (network !== "monetag" && !adScript) {
    return NextResponse.json({ error: "adscript_required_for_non_monetag" }, { status: 400 });
  }
  if (!reward) {
    return NextResponse.json({ error: "reward_required" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      name,
      // For "monetag" tasks this is only an ESTIMATE shown in the task list — the
      // real amount credited is computed per-event from estimated_price at postback
      // time (see /api/postback/monetag). For other networks this is the real,
      // fixed reward actually credited.
      reward: Number(reward),
      adScript: network === "monetag" ? "" : adScript,
      adNetwork: network,
      // "interstitial" | "popup" — only meaningful for network === "monetag".
      adFormat: network === "monetag" && adFormat === "popup" ? "popup" : "interstitial",
      zoneId: network === "monetag" ? null : zoneId || null,
      cooldownSec: Number(cooldownSec) || 0,
      dailyLimit: dailyLimit ? Number(dailyLimit) : null,
      marginPercent: network === "monetag" && marginPercent ? Number(marginPercent) : null,
    },
  });

  return NextResponse.json({ ok: true, task });
}
