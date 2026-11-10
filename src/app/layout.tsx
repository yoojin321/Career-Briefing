import type { Metadata } from "next";
import "./globals.css";
import { ThemeScript } from "@/components/ThemeScript";

export const metadata: Metadata = {
  title: "Career Briefing — 취업 준비 데일리 뉴스",
  description:
    "매일 주요 이슈를 AI가 요약·분석하고 취업 활용 포인트까지 제공하는 개인용 뉴스 학습 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <ThemeScript />
        <div className="app-bg min-h-screen">{children}</div>
      </body>
    </html>
  );
}
