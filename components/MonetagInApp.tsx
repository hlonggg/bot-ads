"use client";
import { useEffect, useRef } from "react";
import { useTelegram } from "@/lib/useTelegram";
import { loadMonetagZoneScript, startMonetagInApp, extractMonetagZoneId } from "@/lib/monetagSdk";

/**
 * In-App Interstitial hiển thị TỰ ĐỘNG theo lịch Monetag quyết định — không do
 * user bấm, KHÔNG có thưởng, KHÔNG liên quan đến hệ thống Task/postback.
 * Vì vậy nó không thuộc form tạo nhiệm vụ, mà là 1 cấu hình chạy nền cho
 * toàn bộ app, bật/tắt từ panel Cài đặt (monetagInAppEnabled).
 *
 * Đặt component này trong root layout để nó chỉ chạy 1 lần cho cả phiên,
 * bất kể user đang ở trang nào (Task/Profile/Panel) — layout không remount
 * khi chuyển trang trong cùng App Router.
 */
export default function MonetagInApp() {
  const { initData, ready } = useTelegram();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!ready || !initData || startedRef.current) return;

    fetch(`/api/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then(async (d) => {
        const s = d.settings || {};
        if (s.monetagInAppEnabled !== "true") return;

        const scriptHtml = s.monetagZoneScript;
        const zoneId = scriptHtml ? extractMonetagZoneId(scriptHtml) : null;
        if (!zoneId || !scriptHtml) return;

        const frequency = Number(s.monetagInAppFrequency) || 1;
        const capping = Number(s.monetagInAppCapping) || 1;
        const interval = Number(s.monetagInAppInterval) || 30;
        const timeout = Number(s.monetagInAppTimeout) || 5;
        const everyPage = s.monetagInAppEveryPage === "true";

        try {
          // loadMonetagZoneScript dedupes internally — an toàn dù trang Nhiệm vụ
          // cũng gọi hàm này để load zone cho Rewarded Interstitial/Popup.
          await loadMonetagZoneScript(zoneId, scriptHtml);
          startMonetagInApp(zoneId, { frequency, capping, interval, timeout, everyPage });
          startedRef.current = true;
        } catch {
          // Script lỗi tải — bỏ qua, không ảnh hưởng phần còn lại của app.
        }
      });
  }, [ready, initData]);

  return null;
}
