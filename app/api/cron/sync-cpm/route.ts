import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMonetagCpm, computeRewardFromCpm } from "@/lib/monetagCpm";
import { fetchUsdToVndRate } from "@/lib/exchangeRate";

async function getSetting(key: string, fallback: string) {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

/**
 * Gọi endpoint này mỗi 5 phút bằng Railway Cron Job (hoặc cron-job.org) với:
 *   GET https://<APP_URL>/api/cron/sync-cpm?secret=CRON_SECRET
 *
 * Lưu ý: Monetag chỉ cập nhật statistics theo GIỜ (hourly), nên dù poll mỗi
 * 5 phút, giá trị CPM có thể không đổi giữa các lần gọi liên tiếp — đó là
 * bình thường, không phải lỗi.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const monetagApiKey = await getSetting("monetagApiKey", "");
  const monetagZoneId = await getSetting("monetagZoneId", "");
  const defaultMargin = Number(await getSetting("defaultMarginPercent", "50"));
  const manualRateFallback = Number(await getSetting("usdVndRateManual", "0")) || undefined;

  const tasks = await prisma.task.findMany({
    where: { dynamicPricing: true, adNetwork: "monetag", isActive: true },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, note: "no dynamic-pricing monetag tasks" });
  }
  if (!monetagZoneId) {
    return NextResponse.json({ ok: false, error: "monetagZoneId chưa cấu hình trong panel" }, { status: 400 });
  }

  const usdToVndRate = await fetchUsdToVndRate(manualRateFallback);

  // All Monetag tasks share the ONE main zone for the whole app (per Monetag docs —
  // sub-zones are internal, not something you configure per task), so we only ever
  // need a single CPM lookup per cron tick, not one per task.
  const cpm = await fetchMonetagCpm(monetagZoneId, monetagApiKey);

  if (cpm === null) {
    return NextResponse.json({ ok: false, error: "monetag_cpm_unavailable", note: "xem TODO trong lib/monetagCpm.ts" });
  }

  let updated = 0;
  for (const task of tasks) {
    const margin = task.marginPercent ?? defaultMargin;
    const reward = computeRewardFromCpm(cpm, usdToVndRate, margin);

    await prisma.task.update({
      where: { id: task.id },
      data: { reward, lastCpmUsd: cpm, lastCpmSyncAt: new Date() },
    });
    updated++;
  }

  return NextResponse.json({ ok: true, updated, cpm, usdToVndRate, tasksChecked: tasks.length });
}
