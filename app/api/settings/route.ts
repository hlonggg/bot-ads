import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";

export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Zone ID không cần lưu riêng — client tự tách ra từ monetagZoneScript
  // (xem lib/monetagSdk.ts: extractMonetagZoneId).
  const PUBLIC_KEYS = [
    "guideText", "minWithdraw", "groupLink", "supportUrl",
    "monetagZoneScript",
    "monetagInAppEnabled", "monetagInAppFrequency", "monetagInAppCapping",
    "monetagInAppInterval", "monetagInAppTimeout", "monetagInAppEveryPage",
  ];

  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;

  return NextResponse.json({ settings });
}
