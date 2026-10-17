import type { Platform, PostStatus } from "@/lib/db/schema";

export const PLATFORM_LABEL: Record<Platform, string> = {
  LINKEDIN: "LinkedIn",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  X: "X",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
};

const PLATFORM_STYLE: Record<Platform, string> = {
  LINKEDIN: "bg-[#0a66c2] text-white",
  FACEBOOK: "bg-[#1877f2] text-white",
  INSTAGRAM: "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white",
  X: "bg-black text-white",
  TIKTOK: "bg-[#111] text-white",
  YOUTUBE: "bg-[#ff0000] text-white",
};

const PLATFORM_LETTER: Record<Platform, string> = { LINKEDIN: "in", FACEBOOK: "f", INSTAGRAM: "IG", X: "X", TIKTOK: "TT", YOUTUBE: "▶" };

export function PlatformBadge({ platform, size = "md" }: { platform: Platform; size?: "sm" | "md" }) {
  const s = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  return (
    <span title={PLATFORM_LABEL[platform]} className={`inline-grid shrink-0 place-items-center rounded-lg font-bold ${s} ${PLATFORM_STYLE[platform]}`}>
      {PLATFORM_LETTER[platform]}
    </span>
  );
}

const STATUS_STYLE: Record<PostStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  awaiting_approval: "bg-amber-100 text-amber-800",
  queued: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};
const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  queued: "Queued",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: PostStatus }) {
  return <span className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 shadow-sm shadow-gray-200/60 ${className}`}>{children}</section>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function formatWhen(d: Date | null): string {
  if (!d) return "Not scheduled";
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
