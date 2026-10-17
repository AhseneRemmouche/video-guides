import { PLATFORMS } from "@/lib/db/schema";
import type { Campaign } from "@/lib/campaign";
import { PLATFORM_LABEL } from "./ui";

/** Shared by the "new campaign" wizard and the settings page. */
export function CampaignFields({ campaign }: { campaign?: Campaign }) {
  const input = "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">
        Campaign name
        <input name="name" required defaultValue={campaign?.name} placeholder="Spring launch" className={input} />
      </label>
      <label className="text-sm font-medium">
        Niche or topic
        <input name="niche" required defaultValue={campaign?.niche} placeholder="Home fitness for busy parents" className={input} />
      </label>
      <label className="text-sm font-medium">
        Audience
        <input name="audience" defaultValue={campaign?.audience} placeholder="Parents aged 30-45 in the US" className={input} />
      </label>
      <label className="text-sm font-medium">
        Goal
        <input name="goal" defaultValue={campaign?.goal} placeholder="Grow followers and drive visits to the blog" className={input} />
      </label>
      <label className="text-sm font-medium">
        Tone of voice
        <input name="tone" defaultValue={campaign?.tone ?? "friendly and clear"} className={input} />
      </label>
      <label className="text-sm font-medium">
        Link that posts point back to
        <input name="link" type="url" defaultValue={campaign?.link} placeholder="https://your-site.com" className={input} />
      </label>
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-medium">Platforms</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name={`platform_${p}`} defaultChecked={campaign ? campaign.platforms.includes(p) : ["LINKEDIN", "INSTAGRAM", "X"].includes(p)} />
              {PLATFORM_LABEL[p]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
