import { redirect } from "next/navigation";
import { getCurrentCampaign } from "@/lib/campaign";
import { TEAM } from "@/lib/ai/agents";
import { PageHeader } from "@/components/ui";
import { LiveOffice } from "./live-office";

export default async function AiAgentPage() {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");
  const team = Object.values(TEAM).map(({ role, name, short, emoji, color }) => ({ role, name, short, emoji, color }));
  return (
    <>
      <PageHeader title="AI Agents" subtitle="Give the Master Agent your requests; it plans the work and runs the team." />
      <LiveOffice campaignId={campaign.id} team={team} />
    </>
  );
}
