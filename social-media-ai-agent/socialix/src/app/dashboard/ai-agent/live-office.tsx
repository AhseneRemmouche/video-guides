"use client";

import { useState } from "react";
import type { AgentRole } from "@/lib/db/schema";
import { Office } from "@/components/office";
import { AgentWorkspace } from "./workspace";

type Member = { role: AgentRole; name: string; short: string; emoji: string; color: string };

/** The chat on the left and the office on the right; desks light up while their agent works. */
export function LiveOffice({ campaignId, team }: { campaignId: string; team: Member[] }) {
  const [working, setWorking] = useState<AgentRole[]>([]);
  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <AgentWorkspace campaignId={campaignId} team={team} onWorking={setWorking} />
      <div className="xl:sticky xl:top-8 xl:self-start">
        <Office working={working} className="aspect-[10/7]" />
        <p className="mt-3 text-center text-xs text-gray-400">Desks light up while an agent is working.</p>
      </div>
    </div>
  );
}
