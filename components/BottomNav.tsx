"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/task", label: "Nhiệm vụ", icon: "🎯" },
    { href: "/profile", label: "Cá nhân", icon: "👤" },
  ];

  return (
    <nav className="bottom-nav fixed bottom-0 left-0 right-0 flex justify-around py-3 z-50">
      {tabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-1 text-sm ${
              active ? "gold-text font-semibold" : "text-gray-400"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
