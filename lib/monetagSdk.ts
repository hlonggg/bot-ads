/**
 * Monetag chỉ đưa cho admin ĐÚNG 1 đoạn script để copy (không có ô "Zone ID"
 * riêng trên dashboard) — nhưng zone ID lại là 1 phần bắt buộc của tên hàm
 * `show_<zoneId>` mà JS cần gọi. Vì zone ID luôn nằm sẵn trong chính script đó
 * (Monetag nhúng nó vào URL/thuộc tính của thẻ <script>), ta tự tách ra bằng
 * regex thay vì bắt admin nhập tay 2 lần 2 chỗ (dễ gõ sai/lệch số).
 *
 * Zone ID Monetag là dãy số dài (thường 7-9 chữ số), nên lấy dãy số dài nhất
 * xuất hiện trong script là đủ an toàn cho cấu trúc script hiện tại của họ.
 */
export function extractMonetagZoneId(scriptHtml: string): string | null {
  const matches = scriptHtml.match(/\d{6,}/g);
  if (!matches || matches.length === 0) return null;
  return matches.reduce((longest, m) => (m.length > longest.length ? m : longest), matches[0]);
}

/**
 * Monetag's SDK exposes a global function named `show_<zoneId>` once the
 * zone's <script> embed tag has loaded. Loading the same zone's script twice
 * is one of the documented common mistakes, so we track loaded zones and
 * dedupe by a stable script id.
 */
const loadedZones = new Set<string>();

export function loadMonetagZoneScript(zoneId: string, scriptHtml: string): Promise<void> {
  if (loadedZones.has(zoneId)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const containerId = `monetag-zone-${zoneId}`;
    if (document.getElementById(containerId)) {
      loadedZones.add(zoneId);
      resolve();
      return;
    }

    // scriptHtml is the raw embed snippet pasted by the admin from the Monetag
    // dashboard for this zone (usually a single <script src="..."> tag).
    const container = document.createElement("div");
    container.id = containerId;
    container.style.display = "none";
    container.innerHTML = scriptHtml;
    document.body.appendChild(container);

    const scriptEl = container.querySelector("script");
    if (!scriptEl) {
      // Inline script with no src — innerHTML already executed it synchronously
      loadedZones.add(zoneId);
      resolve();
      return;
    }

    if (scriptEl.src) {
      // innerHTML doesn't execute <script src="..."> tags, so re-create it properly.
      // QUAN TRỌNG: phải copy TOÀN BỘ attribute gốc (data-zone, data-sdk, ...), không
      // chỉ src — Monetag SDK đọc data-zone/data-sdk để biết zone nào và đặt tên hàm
      // show_<zoneId> global. Copy thiếu 2 attribute này thì script tải được nhưng
      // SDK không hoạt động đúng, show_<zoneId> sẽ không tồn tại.
      const s = document.createElement("script");
      for (const attr of Array.from(scriptEl.attributes)) {
        s.setAttribute(attr.name, attr.value);
      }
      s.async = true;
      s.onload = () => {
        loadedZones.add(zoneId);
        resolve();
      };
      s.onerror = () => reject(new Error("monetag_script_failed_to_load"));
      scriptEl.remove();
      container.appendChild(s);
    } else {
      loadedZones.add(zoneId);
      resolve();
    }
  });
}

/**
 * Rewarded Interstitial — preload + show chain exactly as recommended in
 * Monetag's docs: show_XXX({ type: 'preload', ymid }).then(() => show_XXX({ ymid }))
 * `ymid` must be our own requestId so the postback can be matched back to
 * the correct TaskCompletion row server-side.
 */
export function showMonetagRewardedInterstitial(zoneId: string, ymid: string): Promise<void> {
  const fn = (window as any)[`show_${zoneId}`];
  if (typeof fn !== "function") {
    return Promise.reject(new Error("monetag_sdk_not_ready"));
  }
  return fn({ type: "preload", ymid }).then(() => fn({ ymid }));
}

/**
 * Rewarded Popup — opens directly to the offer page, no preload step (per
 * Monetag docs, only Rewarded Interstitial documents a preload flow). Must
 * be called synchronously inside a user action (e.g. a button onClick).
 */
export function showMonetagRewardedPopup(zoneId: string, ymid: string): Promise<void> {
  const fn = (window as any)[`show_${zoneId}`];
  if (typeof fn !== "function") {
    return Promise.reject(new Error("monetag_sdk_not_ready"));
  }
  return fn({ type: "pop", ymid });
}

/**
 * In-App Interstitial — a native banner Monetag shows automatically on its
 * own schedule (frequency/capping/interval/timeout), with NO reward and NO
 * postback/ymid involved. Call this once, globally, when the app loads — not
 * per task, and not from the task claim flow.
 */
export interface MonetagInAppSettings {
  frequency: number;
  capping: number;
  interval: number;
  timeout: number;
  everyPage?: boolean;
}

export function startMonetagInApp(zoneId: string, inAppSettings: MonetagInAppSettings): void {
  const fn = (window as any)[`show_${zoneId}`];
  if (typeof fn !== "function") return;
  fn({ type: "inApp", inAppSettings });
}
