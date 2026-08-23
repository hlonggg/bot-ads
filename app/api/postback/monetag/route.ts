import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchUsdToVndRate } from "@/lib/exchangeRate";
import { handleTaskConfirmedForReferral } from "@/lib/referral";

/**
 * Dán URL này vào "Your backend URL" trong Monetag SSP → Postbacks (mỗi zone
 * cấu hình riêng, dán y hệt, KHÔNG sửa tên macro):
 *
 *   https://<APP_URL>/api/postback/monetag?ymid={ymid}&event_type={event_type}&reward_event_type={reward_event_type}&estimated_price={estimated_price}&telegram_id={telegram_id}&zone_id={zone_id}&sub_zone_id={sub_zone_id}&request_var={request_var}&secret=YOUR_POSTBACK_SECRET
 *
 * Monetag sẽ tự thay {ymid}, {event_type}... bằng giá trị thật khi gọi.
 * ymid = requestId chúng ta tạo lúc claim và truyền vào show_XXX({ ymid }).
 *
 * Theo Macro Reference chính thức (docs.monetag.com/docs/postbacks/macroses):
 *   reward_event_type = "valued"      -> sự kiện ĐÃ được tính tiền, được thưởng
 *   reward_event_type = "not_valued"  -> bị lọc (spam/gian lận/fallback), KHÔNG thưởng
 *   estimated_price    -> doanh thu ước tính của ĐÚNG lượt xem này, tính bằng USD
 *
 * Thưởng cho user (task Monetag) được tính NGAY LÚC NÀY, từ estimated_price của
 * chính lượt xem này — không dùng CPM trung bình cache trước đó (số CPM trung bình
 * của Monetag cập nhật trễ hàng giờ và không phản ánh đúng giá trị lượt xem cụ thể,
 * dễ gây lệch/lỗ). Task không phải Monetag (adsterra/custom) vẫn dùng reward cố định
 * đã snapshot lúc claim, vì các network đó không gửi estimated_price qua postback này.
 */
export async function GET(req: NextRequest) {
  const ymid = req.nextUrl.searchParams.get("ymid");
  const eventType = req.nextUrl.searchParams.get("event_type");
  const rewardEventType = req.nextUrl.searchParams.get("reward_event_type");
  const estimatedPrice = req.nextUrl.searchParams.get("estimated_price");
  const secret = req.nextUrl.searchParams.get("secret");
  // Không dùng trong logic tính thưởng — chỉ nhận & log thêm để debug xem
  // Monetag có thực sự gọi tới không và gọi với dữ liệu gì.
  const telegramId = req.nextUrl.searchParams.get("telegram_id");
  const zoneId = req.nextUrl.searchParams.get("zone_id");
  const subZoneId = req.nextUrl.searchParams.get("sub_zone_id");
  const requestVar = req.nextUrl.searchParams.get("request_var");

  console.log("[postback:monetag] incoming", {
    ymid, eventType, rewardEventType, estimatedPrice,
    telegramId, zoneId, subZoneId, requestVar,
    secretMatches: secret === process.env.POSTBACK_SECRET,
  });

  if (!ymid || secret !== process.env.POSTBACK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const completion = await prisma.taskCompletion.findUnique({
    where: { requestId: ymid },
    include: { task: true },
  });
  if (!completion) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (completion.status !== "PENDING") {
    // already processed — respond 200 so Monetag doesn't retry forever (idempotent per ymid)
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Rewarded Interstitial: the "impression" event is what completes the ad view.
  // A "click" postback is a separate, secondary event — crediting on it too would
  // double-pay for a single ad view.
  const isValidRewardEvent = eventType === "impression" && rewardEventType === "valued";

  if (!isValidRewardEvent) {
    const priceUsdRejected = Number(estimatedPrice);
    await prisma.taskCompletion.update({
      where: { id: completion.id },
      data: {
        status: "REJECTED",
        estimatedPriceUsd: priceUsdRejected > 0 ? priceUsdRejected : undefined,
      },
    });
    return NextResponse.json({ ok: true, rewarded: false, reason: "not_valued_or_wrong_event" });
  }

  // --- Compute the real, per-event reward from estimated_price ---
  let finalReward = completion.reward; // fallback: the snapshot taken at claim time
  const priceUsd = Number(estimatedPrice);
  let marginPercentUsed = 0;

  if (completion.task.adNetwork === "monetag" && estimatedPrice && !Number.isNaN(priceUsd) && priceUsd > 0) {
    marginPercentUsed = completion.task.marginPercent ?? Number(
      (await prisma.setting.findUnique({ where: { key: "defaultMarginPercent" } }))?.value ?? "50"
    );
    const manualRateFallback = Number(
      (await prisma.setting.findUnique({ where: { key: "usdVndRateManual" } }))?.value ?? "0"
    ) || undefined;
    const usdToVndRate = await fetchUsdToVndRate(manualRateFallback);

    finalReward = Math.round(priceUsd * usdToVndRate * (marginPercentUsed / 100));
  }

  await prisma.$transaction([
    prisma.taskCompletion.update({
      where: { id: completion.id },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        reward: finalReward,
        estimatedPriceUsd: priceUsd > 0 ? priceUsd : undefined,
      },
    }),
    prisma.user.update({
      where: { id: completion.userId },
      data: { balance: { increment: finalReward } },
    }),
  ]);

  // Cập nhật mốc/hoa hồng referral (nếu user này được ai đó mời) — không được
  // để lỗi ở đây làm hỏng response postback chính, nên bọc try/catch riêng.
  try {
    await handleTaskConfirmedForReferral({
      userId: completion.userId,
      completionId: completion.id,
      rewardVnd: finalReward,
      marginPercent: marginPercentUsed,
      adNetwork: completion.task.adNetwork,
    });
  } catch (e) {
    console.error("[postback:monetag] referral handling failed", e);
  }

  return NextResponse.json({ ok: true, rewarded: true, reward: finalReward });
}
