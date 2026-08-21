"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

const FIELDS = [
  { key: "guideText", label: "Nội dung hướng dẫn", type: "textarea" },
  { key: "minWithdraw", label: "Số tiền rút tối thiểu", type: "number" },
  { key: "groupLink", label: "Link nhóm (nút Nền tảng)", type: "text" },
  { key: "supportUrl", label: "Link hỗ trợ khách hàng", type: "text" },
];

const CPM_FIELDS = [
  { key: "monetagZoneScript", label: "Script Monetag (dán nguyên đoạn Monetag đưa cho bạn — Zone ID được tự động lấy từ đây)", type: "textarea" },
  { key: "defaultMarginPercent", label: "Tỷ lệ trả user mặc định (%) — áp dụng theo từng lượt xem", type: "number" },
  { key: "usdVndRateManual", label: "Tỷ giá USD→VND dự phòng (khi API tỷ giá lỗi)", type: "number" },
];

// In-App Interstitial: banner tự động hiển thị theo lịch, KHÔNG phải nhiệm vụ,
// KHÔNG có thưởng — nên cấu hình ở đây (áp dụng toàn app), không phải trong
// form tạo nhiệm vụ. Enabled khi monetagInAppEnabled = "true".
const INAPP_FIELDS = [
  { key: "monetagInAppEnabled", label: 'Bật quảng cáo tự động (gõ "true" để bật, để trống = tắt)', type: "text" },
  { key: "monetagInAppFrequency", label: "Số quảng cáo hiển thị trong 1 khung capping (frequency)", type: "number" },
  { key: "monetagInAppCapping", label: "Độ dài khung thời gian, tính bằng GIỜ (capping, vd 0.1 = 6 phút)", type: "number" },
  { key: "monetagInAppInterval", label: "Khoảng cách giữa 2 lần hiện quảng cáo, tính bằng GIÂY (interval)", type: "number" },
  { key: "monetagInAppTimeout", label: "Trễ trước lần hiện đầu tiên, tính bằng GIÂY (timeout)", type: "number" },
  { key: "monetagInAppEveryPage", label: 'Reset lại lịch khi chuyển trang? ("true" hoặc "false")', type: "text" },
];

export default function PanelSettingsPage() {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");

  function load(initData: string) {
    fetch(`/api/panel/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setValues(d.settings || {}));
  }

  async function save(initData: string, key: string) {
    setSaving(key);
    await fetch("/api/panel/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, key, value: values[key] || "" }),
    });
    setSaving("");
  }

  return (
    <PanelGuard>
      {(initData) => (
        <Inner initData={initData} values={values} setValues={setValues} load={load} save={save} saving={saving} router={router} />
      )}
    </PanelGuard>
  );
}

function Inner({ initData, values, setValues, load, save, saving, router }: any) {
  useEffect(() => {
    load(initData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-4">Cài đặt & Hướng dẫn</h1>

      <div className="flex flex-col gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="card p-4">
            <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                rows={5}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            )}
            <button onClick={() => save(initData, f.key)} className="btn-gold px-4 py-1.5 text-xs mt-2">
              {saving === f.key ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-sm font-semibold text-charcoal mt-6 mb-3">Monetag (thưởng theo giá trị thực từng lượt xem)</p>
      <div className="flex flex-col gap-4">
        {CPM_FIELDS.map((f) => (
          <div key={f.key} className="card p-4">
            <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea
                rows={4}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            ) : (
              <input
                type={f.type}
                value={values[f.key] || ""}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            )}
            <button onClick={() => save(initData, f.key)} className="btn-gold px-4 py-1.5 text-xs mt-2">
              {saving === f.key ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-sm font-semibold text-charcoal mt-6 mb-3">Quảng cáo tự động (In-App Interstitial)</p>
      <p className="text-xs text-gray-400 mb-3">
        Loại này Monetag tự hiển thị theo lịch, không cần user bấm gì — vì vậy KHÔNG có thưởng và
        không xuất hiện trong danh sách nhiệm vụ. Dùng chung 1 zone ở trên, chỉ cần bật/cấu hình ở đây.
      </p>
      <div className="flex flex-col gap-4">
        {INAPP_FIELDS.map((f) => (
          <div key={f.key} className="card p-4">
            <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
            <input
              type={f.type}
              value={values[f.key] || ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
            />
            <button onClick={() => save(initData, f.key)} className="btn-gold px-4 py-1.5 text-xs mt-2">
              {saving === f.key ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
