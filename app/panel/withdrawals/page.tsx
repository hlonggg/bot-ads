"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

interface Withdrawal {
  id: string;
  amount: number;
  bankAccountName: string;
  bankName: string;
  user: { username?: string; firstName?: string; telegramId: string };
}

export default function PanelWithdrawalsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [copiedId, setCopiedId] = useState("");

  function load(initData: string) {
    fetch(`/api/panel/withdrawals?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.withdrawals || []));
  }

  async function resolve(initData: string, id: string, action: "approve" | "reject") {
    await fetch(`/api/panel/withdrawals/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, action }),
    });
    load(initData);
  }

  function copyBank(id: string, bankName: string) {
    navigator.clipboard.writeText(bankName);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1500);
  }

  return (
    <PanelGuard>
      {(initData) => (
        <Inner initData={initData} items={items} load={load} resolve={resolve} copyBank={copyBank} copiedId={copiedId} router={router} />
      )}
    </PanelGuard>
  );
}

function Inner({ initData, items, load, resolve, copyBank, copiedId, router }: any) {
  useEffect(() => {
    load(initData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-4">Rút tiền</h1>

      {items.length === 0 && <div className="card p-6 text-center text-gray-400 text-sm">Không có yêu cầu nào</div>}

      <div className="flex flex-col gap-3">
        {items.map((w: Withdrawal) => (
          <div key={w.id} className="card p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-charcoal">{w.amount.toLocaleString("vi-VN")}đ</p>
                <p className="text-xs text-gray-400">
                  {w.user.firstName || w.user.username} · ID {w.user.telegramId}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-ivory rounded-xl px-3 py-2 mb-2">
              <div className="text-sm">
                <p className="text-charcoal font-medium">{w.bankName}</p>
                <p className="text-gray-500 text-xs">{w.bankAccountName}</p>
              </div>
              <button
                onClick={() => copyBank(w.id, w.bankName)}
                className="text-xs text-gold-dark font-semibold px-2 py-1 border border-gold rounded-lg"
              >
                {copiedId === w.id ? "Đã chép" : "Sao chép"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(initData, w.id, "approve")}
                className="flex-1 bg-green-600 text-white text-sm py-2 rounded-xl font-medium"
              >
                Duyệt
              </button>
              <button
                onClick={() => resolve(initData, w.id, "reject")}
                className="flex-1 bg-red-500 text-white text-sm py-2 rounded-xl font-medium"
              >
                Từ chối
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
