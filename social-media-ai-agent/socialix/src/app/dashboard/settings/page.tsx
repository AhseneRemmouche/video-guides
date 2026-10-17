import { redirect } from "next/navigation";
import { getCurrentCampaign } from "@/lib/campaign";
import { getAutoPublish } from "@/lib/publishing";
import { config } from "@/lib/env";
import { Card, PageHeader } from "@/components/ui";
import { CampaignFields } from "@/components/campaign-form";
import { setAutoPublishAction, updateCampaign } from "../actions";

export default async function SettingsPage() {
  const campaign = await getCurrentCampaign();
  if (!campaign) redirect("/dashboard/campaigns/new");
  const autoPublish = await getAutoPublish();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-4 font-semibold">Campaign brief</h2>
          <form action={updateCampaign} className="flex flex-col gap-6">
            <input type="hidden" name="id" value={campaign.id} />
            <CampaignFields campaign={campaign} />
            <button className="self-start rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-medium text-white">Save</button>
          </form>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-semibold">Publishing</h2>
            <form action={setAutoPublishAction} className="mt-3 flex flex-col gap-3">
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="autoPublish" defaultChecked={autoPublish} className="mt-1" />
                <span>
                  <strong>Auto-publish.</strong> When the Scheduler Agent schedules a post, hand it straight to the autopilot&apos;s queue, with no approval step. Leave this off to approve every post yourself.
                </span>
              </label>
              <button className="self-start rounded-xl border border-gray-200 px-4 py-2 text-sm">Save</button>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold">Team</h2>
            <ul className="mt-3 space-y-1 text-sm text-gray-600">
              <li>Master, Research and Creator agents: {config.modelSmart}</li>
              <li>Scheduler and Analytics agents: {config.modelFast}</li>
              <li>Claude key, database and site URL: read from {config.autopilotDir}/.env</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
