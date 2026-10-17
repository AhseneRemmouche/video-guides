import { callSocialTool } from "@/lib/mcp/social";
import type { Platform } from "@/lib/db/schema";
import { Card, PageHeader, PLATFORM_LABEL, PlatformBadge } from "@/components/ui";

type Connection = { platform: Platform; status: string; canAutoPublish: boolean; requiresMedia: boolean; charLimit: number };

const STATUS: Record<string, string> = {
  CONNECTED: "bg-emerald-100 text-emerald-800",
  TOKEN_EXPIRED: "bg-amber-100 text-amber-800",
  DISCONNECTED: "bg-gray-100 text-gray-600",
};

export default async function AccountsPage() {
  let connections: Connection[] = [];
  let error = "";
  try {
    const r = await callSocialTool("list_connections", {});
    if (r.isError) error = r.text;
    else connections = JSON.parse(r.text) as Connection[];
  } catch (e) {
    error = e instanceof Error ? e.message : "The Social Publisher MCP server could not be reached.";
  }

  return (
    <>
      <PageHeader title="Accounts" subtitle="Social accounts connected in the WordPress Social Autopilot, read through the Social Publisher MCP server" />
      {error && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {connections.map((c) => (
          <Card key={c.platform} className="flex items-start gap-4">
            <PlatformBadge platform={c.platform} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{PLATFORM_LABEL[c.platform]}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS[c.status] ?? STATUS.DISCONNECTED}`}>{c.status.replace("_", " ").toLowerCase()}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Up to {c.charLimit.toLocaleString()} characters{c.requiresMedia ? " · needs an image" : ""}
                {!c.canAutoPublish ? " · manual posting only" : ""}
              </p>
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-gray-500">
        Connect, reconnect or disconnect accounts in the WordPress Social Autopilot (Connections page). Socialix never sees the access tokens: approved posts are handed to the autopilot&apos;s queue, and its worker publishes them.
      </p>
    </>
  );
}
