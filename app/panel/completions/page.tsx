"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

interface Completion {
  id: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  reward: number;
  estimatedPriceUsd: number | null;
  confirmedVia: string | null;
  createdAt: string;
  confirmedAt: string | null;
  task: { name: string; adNetwork: string };
  user: { username?: string; firstName?: string; telegramId: string };
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "✅ Đã cộng tiền",
  PENDING: "⏳ Đang chờ postback",
  REJECTED: "❌ Bị từ chối",
};

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: "text-green-600",
  PENDING: "text-amber-600",
  REJECTED: "text-red-500",
};

export default function PanelCompletionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Completion[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");

  function load(initData: string, status?: string) {
    const q = status ? `&status=${status}` : "";
    fetch(`/api/panel/completions?initData=${encodeURIComponent(initData)}${q}`)
      .then((r) => r.json())
      .then((d) => setItems(d.completions || []));
  }

  return (
    <PanelGuard>
      {(initData) => (
        <Inner initData={initData} items={items} load={load} statusFilter={statusFilter} setStatusFilter={setStatusFilter} router={router} />
      )}
    </PanelGuard>
  );
}

function Inner({ initData, items, load, statusFilter, setStatusFilter, router }: any) {
  useEffect(() => {
    load(initData, statusFilter || undefined);
    // Tự làm mới mỗi 15s để thấy postback mới về gần như realtime, khỏi phải bấm lại
    const t = setInterval(() => load(initData, statusFilter || undefined), 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, statusFilter]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.push("/panel")} className="text-sm text-gray-400 mb-3">← Quay lại</button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-2">Lượt xem</h1>
      <p className="text-xs text-gray-400 mb-4">
        100 lượt gần nhất, tự làm mới mỗi 15s. Dòng có nhãn <span className="text-red-500">⚠ qua client</span> là
        xác nhận tạm bằng phía trình duyệt (trong lúc chờ Monetag gửi postback), kém tin cậy hơn — nếu 1 user có
        nhiều lượt dạng này liên tục, sát đúng ngưỡng thời gian tối thiểu, nên nghi ngờ gian lận.
      </p>

      <div className="flex gap-2 mb-4">
        {["", "CONFIRMED", "PENDING", "REJECTED"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              statusFilter === s ? "bg-charcoal text-white border-charcoal" : "border-gray-200 text-gray-500"
            }`}
          >
            {s ? STATUS_LABEL[s] : "Tất cả"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {items.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Chưa có lượt nào.</p>}
        {items.map((c: Completion) => (
          <div key={c.id} className="card p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-charcoal">{c.task.name}</p>
                <p className="text-xs text-gray-400">
                  {c.user.firstName || c.user.username || c.user.telegramId} · {c.task.adNetwork}
                </p>
              </div>
              <span className={`text-xs font-medium ${STATUS_COLOR[c.status]}`}>
                {STATUS_LABEL[c.status]}
                {c.confirmedVia === "client" && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] align-middle">
                    ⚠ qua client
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between items-end mt-2">
              <p className="text-[11px] text-gray-400">
                {new Date(c.createdAt).toLocaleString("vi-VN")}
                {c.estimatedPriceUsd != null && ` · estimated_price $${c.estimatedPriceUsd.toFixed(5)}`}
              </p>
              <p className="text-sm font-semibold text-charcoal">
                {c.status === "REJECTED" ? "0đ" : `+${c.reward.toLocaleString("vi-VN")}đ`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
