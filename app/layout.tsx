import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "龚梦星 · AI 产品经理",
  description: "硬核 AI 产品经理个人网站 · RAG · Agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
