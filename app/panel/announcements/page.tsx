"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

export default function AnnouncementsPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  async function send(initData: string) {
    if (!text.trim()) return;
    setSending(true);
    setResult("");
    const res = await fetch("/api/panel/announcements/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, text }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) {
      setResult(`Đã gửi ${data.sent}/${data.total} người dùng`);
      setText("");
    } else {
      setResult("Có lỗi xảy ra");
    }
  }

  return (
    <PanelGuard>
      {(initData) => (
        <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
          <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
            ← Quay lại
          </button>
          <h1 className="font-display text-2xl font-semibold gold-text mb-4">Thông báo</h1>
          <div className="card p-5 flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
              placeholder="Nhập nội dung thông báo..."
            />
            <button onClick={() => send(initData)} disabled={sending} className="btn-gold py-3 text-sm">
              {sending ? "Đang gửi..." : "Gửi cho tất cả người dùng"}
            </button>
            {result && <p className="text-xs text-gray-500">{result}</p>}
          </div>
        </main>
      )}
    </PanelGuard>
  );
}
