import { Card, PageHeader } from "@/components/ui";
import { CampaignFields } from "@/components/campaign-form";
import { Office } from "@/components/office";
import { createCampaign } from "../../actions";

export default function NewCampaignPage() {
  return (
    <>
      <PageHeader title="Create a campaign" subtitle="Tell your AI team what you are promoting. They use this brief for every task." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <form action={createCampaign} className="flex flex-col gap-6">
            <CampaignFields />
            <button className="self-start rounded-xl bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">Create campaign</button>
          </form>
        </Card>
        <Office className="aspect-[10/7]" />
      </div>
    </>
  );
}
