import { Sparkles } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-md shadow-indigo-200">
        <Sparkles size={18} />
      </span>
      {!compact && <span className="text-lg font-semibold tracking-tight">Socialix</span>}
    </div>
  );
}
