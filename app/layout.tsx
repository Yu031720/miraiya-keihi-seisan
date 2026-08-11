import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "みらいや経費精算",
  description: "週次経費報告を簡単にまとめるための社内ツール",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "経費精算",
  },
};

export const viewport: Viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-orange-50 text-zinc-900">{children}</body>
    </html>
  );
}
