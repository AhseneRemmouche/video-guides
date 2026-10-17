"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, CalendarDays, FileText, LayoutGrid, Link2, Settings } from "lucide-react";
import { Logo } from "./logo";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/ai-agent", label: "AI Agent", icon: Bot },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/accounts", label: "Accounts", icon: Link2 },
];

export function Sidebar({ campaignPicker, footer }: { campaignPicker: React.ReactNode; footer: React.ReactNode }) {
  const path = usePathname();
  const item = (href: string, label: string, Icon: typeof LayoutGrid) => {
    const active = href === "/dashboard" ? path === href : path.startsWith(href);
    return (
      <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-600 text-white shadow-md shadow-indigo-200" : "text-gray-600 hover:bg-gray-100"}`}>
        <Icon size={18} />
        {label}
      </Link>
    );
  };
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-4 border-r border-gray-100 bg-white p-4 md:flex">
      <Logo />
      {campaignPicker}
      <nav className="flex flex-col gap-1">
        <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Menu</p>
        {NAV.map((n) => item(n.href, n.label, n.icon))}
      </nav>
      <div className="mt-auto flex flex-col gap-1">
        {item("/dashboard/settings", "Settings", Settings)}
        {footer}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-3 py-2 md:hidden">
      {[...NAV, { href: "/dashboard/settings", label: "Settings", icon: Settings }].map(({ href, label }) => {
        const active = href === "/dashboard" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-600 text-white" : "text-gray-600"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
