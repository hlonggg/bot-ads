/**
 * Pulls the current CPM (USD per 1000 impressions) for a given Monetag zone.
 *
 * ⚠️ TODO — bạn cần điền đúng request thật ở đây:
 * Monetag không công bố schema Statistics API công khai mà tôi có thể verify được,
 * nó gắn với tài khoản publisher đã đăng nhập của bạn. Cách lấy chính xác:
 *   1. Đăng nhập https://publishers.monetag.com/statistics
 *   2. Filter theo Zone -> hôm nay -> mở phần "Export"/API export báo cáo
 *      (CSV/JSON), nó sẽ cho bạn 1 REST URL kèm token thật của tài khoản bạn.
 *   3. Copy URL đó, thay vào MONETAG_STATS_URL bên dưới, map field CPM đúng tên
 *      cột mà response trả về (ví dụ có thể là "cpm", "ecpm", tuỳ version).
 *
 * Cho tới khi bạn điền, hàm này trả về null — cron sẽ log cảnh báo thay vì
 * âm thầm dùng số sai.
 */
export async function fetchMonetagCpm(zoneId: string, apiKey: string): Promise<number | null> {
  if (!zoneId || !apiKey) return null;

  try {
    // --- THAY THẾ đoạn dưới bằng request thật từ tài khoản Monetag của bạn ---
    // const res = await fetch(
    //   `https://api.monetag.com/v5/stats?zone_id=${zoneId}&date_from=today&date_to=today`,
    //   { headers: { Authorization: `Bearer ${apiKey}` } }
    // );
    // const data = await res.json();
    // const cpm = data?.result?.[0]?.cpm;
    // return typeof cpm === "number" ? cpm : null;

    console.warn("[monetagCpm] fetchMonetagCpm() chưa được cấu hình với API thật — xem TODO trong lib/monetagCpm.ts");
    return null;
  } catch (e) {
    console.error("[monetagCpm] fetch failed", e);
    return null;
  }
}

/**
 * reward (VND, per 1 view) = (cpmUsd / 1000) * usdToVndRate * (marginPercent / 100)
 *
 * Ví dụ đúng như yêu cầu: CPM $1/1000 view, margin 50% ->
 *   revenuePerView = 1/1000 = $0.001
 *   userReward     = $0.001 * 50% = $0.0005 -> * tỷ giá VND
 */
export function computeRewardFromCpm(cpmUsd: number, usdToVndRate: number, marginPercent: number): number {
  const revenuePerViewUsd = cpmUsd / 1000;
  const userShareUsd = revenuePerViewUsd * (marginPercent / 100);
  const rewardVnd = userShareUsd * usdToVndRate;
  return Math.round(rewardVnd); // VND has no decimals
}
