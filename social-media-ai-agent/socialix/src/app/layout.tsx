import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Socialix · AI social media team",
  description: "A team of Claude agents that researches, writes and schedules your social media posts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
