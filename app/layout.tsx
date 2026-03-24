import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FloatingChat } from "@/components/FloatingChat";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="zh-CN" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <FloatingChat />
      </body>
    </html>
  );
}
