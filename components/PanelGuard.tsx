"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/lib/useTelegram";

export default function PanelGuard({ children }: { children: (initData: string) => React.ReactNode }) {
  const { initData, ready } = useTelegram();
  const [status, setStatus] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/panel/auth?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.isAdmin ? "ok" : "denied"));
  }, [ready, initData]);

  if (status === "checking") {
    return <div className="p-6 text-center text-gray-400 text-sm">Đang xác thực...</div>;
  }
  if (status === "denied") {
    return <div className="p-6 text-center text-gray-400 text-sm">Bạn không có quyền truy cập.</div>;
  }
  return <>{children(initData)}</>;
}
