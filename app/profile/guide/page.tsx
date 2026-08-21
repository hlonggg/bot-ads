"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/lib/useTelegram";

export default function GuidePage() {
  const { initData, ready } = useTelegram();
  const router = useRouter();
  const [text, setText] = useState("");

  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setText(d.settings?.guideText || "Chưa có nội dung hướng dẫn."));
  }, [ready, initData]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-4">Hướng dẫn</h1>
      <div className="card p-5 text-sm text-charcoal whitespace-pre-wrap leading-relaxed">{text}</div>
    </main>
  );
}
