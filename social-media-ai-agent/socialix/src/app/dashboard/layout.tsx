import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getCurrentCampaign, listCampaigns } from "@/lib/campaign";
import { MobileNav, Sidebar } from "@/components/sidebar";
import { signOut, switchCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireSession();
  const [current, all] = await Promise.all([getCurrentCampaign(), listCampaigns()]);

  const picker = (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Campaign</p>
      {current ? (
        <form action={switchCampaign} className="mt-1">
          <select name="id" defaultValue={current.id} className="w-full bg-transparent text-sm font-semibold outline-none">
            {all.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button className="rounded-lg bg-white px-2 py-1 text-xs text-gray-600 shadow-sm">Switch</button>
            <Link href="/dashboard/campaigns/new" className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs text-gray-600 shadow-sm">
              <Plus size={12} /> New
            </Link>
          </div>
        </form>
      ) : (
        <Link href="/dashboard/campaigns/new" className="mt-1 block text-sm font-semibold text-brand-600">
          Create your first campaign
        </Link>
      )}
    </div>
  );

  const footer = (
    <form action={signOut} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-500">
      <span className="truncate">{owner}</span>
      <button title="Sign out" className="rounded-lg p-1 hover:bg-gray-100">
        <LogOut size={16} />
      </button>
    </form>
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar campaignPicker={picker} footer={footer} />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <main className="mx-auto max-w-7xl p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
