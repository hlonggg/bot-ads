"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTelegram } from "@/lib/useTelegram";
import BottomNav from "@/components/BottomNav";

interface Me {
  firstName?: string;
  telegramId: string;
  balance: number;
}

export default function ProfilePage() {
  const { initData, ready } = useTelegram();
  const [me, setMe] = useState<Me | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/me?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setMe(d.user));
    fetch(`/api/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings || {}));
  }, [ready, initData]);

  const menuItems = [
    { label: "Rút tiền", href: "/profile/withdraw", icon: "💸" },
    { label: "Mời bạn bè", href: "/profile/referral", icon: "🎁" },
    { label: "Hỗ trợ khách hàng", href: settings.supportUrl || "#", icon: "🎧", external: true },
    { label: "Nền tảng", href: settings.groupLink || "#", icon: "👥", external: true },
    { label: "Hướng dẫn", href: "/profile/guide", icon: "📖" },
  ];

  return (
    <main className="pb-24 px-4 pt-6 max-w-md mx-auto">
      <div className="card p-6 text-center mb-6">
        <div className="w-16 h-16 rounded-full gold-gradient mx-auto mb-3 flex items-center justify-center text-2xl">
          👤
        </div>
        <h1 className="font-display text-2xl font-semibold text-charcoal">
          {me?.firstName || "Người dùng"}
        </h1>
        <p className="text-gray-400 text-xs mb-3">ID: {me?.telegramId ?? "..."}</p>
        <p className="gold-text font-display text-3xl font-bold">
          {(me?.balance ?? 0).toLocaleString("vi-VN")}đ
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {menuItems.map((item) =>
          item.external ? (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="card p-4 flex items-center gap-3"
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-charcoal">{item.label}</span>
            </a>
          ) : (
            <Link key={item.label} href={item.href} className="card p-4 flex items-center gap-3">
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-charcoal">{item.label}</span>
            </Link>
          )
        )}
      </div>

      <BottomNav />
    </main>
  );
}
