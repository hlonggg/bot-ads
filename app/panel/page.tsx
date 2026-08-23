"use client";
import Link from "next/link";
import PanelGuard from "@/components/PanelGuard";

export default function PanelHome() {
  const sections = [
    { href: "/panel/announcements", label: "Thông báo", icon: "📢" },
    { href: "/panel/tasks", label: "Nhiệm vụ", icon: "🎯" },
    { href: "/panel/completions", label: "Lượt xem", icon: "📊" },
    { href: "/panel/withdrawals", label: "Rút tiền", icon: "💸" },
    { href: "/panel/guide", label: "Cài đặt & Hướng dẫn", icon: "⚙️" },
  ];

  return (
    <PanelGuard>
      {() => (
        <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
          <h1 className="font-display text-2xl font-semibold gold-text mb-6">Admin Panel</h1>
          <div className="flex flex-col gap-3">
            {sections.map((s) => (
              <Link key={s.href} href={s.href} className="card p-4 flex items-center gap-3">
                <span className="text-xl">{s.icon}</span>
                <span className="font-medium text-charcoal">{s.label}</span>
              </Link>
            ))}
          </div>
        </main>
      )}
    </PanelGuard>
  );
}
