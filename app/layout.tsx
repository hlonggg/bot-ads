import "./globals.css";
import Script from "next/script";
import MonetagInApp from "@/components/MonetagInApp";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="bg-ivory min-h-screen">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <MonetagInApp />
        {children}
      </body>
    </html>
  );
}
