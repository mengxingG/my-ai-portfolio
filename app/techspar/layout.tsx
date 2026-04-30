import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TechSpar 面试教练",
  description: "面向技术岗位的模拟面试与反馈教练。",
};

export default function TechSparLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
