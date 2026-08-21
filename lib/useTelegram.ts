"use client";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        MainButton: any;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}

export function useTelegram() {
  const [initData, setInitData] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      setInitData(tg.initData);
    }
    setReady(true);
  }, []);

  return { initData, ready, webApp: typeof window !== "undefined" ? window.Telegram?.WebApp : undefined };
}
