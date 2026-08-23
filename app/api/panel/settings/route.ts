import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminInitData } from "@/lib/panelAuth";

// Admin-only read of ALL settings (including secrets like monetagApiKey) —
// separate from the public /api/settings endpoint which filters those out.
export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") || "";
  const admin = verifyAdminInitData(initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;

  return NextResponse.json({ settings });
}

const ALLOWED_KEYS = [
  "guideText",
  "minWithdraw",
  "groupLink",
  "supportUrl",
  "botUsername",
  "monetagZoneScript",
  "defaultMarginPercent",
  "usdVndRateManual",
  "monetagInAppEnabled",
  "monetagInAppFrequency",
  "monetagInAppCapping",
  "monetagInAppInterval",
  "monetagInAppTimeout",
  "monetagInAppEveryPage",
];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const admin = verifyAdminInitData(body.initData);
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { key, value } = body;
  if (!ALLOWED_KEYS.includes(key)) return NextResponse.json({ error: "invalid_key" }, { status: 400 });

  await prisma.setting.upsert({
    where: { key },
    update: { value: String(value ?? "") },
    create: { key, value: String(value ?? "") },
  });

  return NextResponse.json({ ok: true });
}
