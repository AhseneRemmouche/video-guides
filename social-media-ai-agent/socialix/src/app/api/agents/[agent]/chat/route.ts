import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AGENTS } from "@/lib/db/schema";
import { startChat } from "@/lib/ai/runner";

const Body = z.object({ campaignId: z.string().min(1), message: z.string().min(1).max(4000) });

/** POST a message to an agent. The reply is produced in the background; poll the messages route. */
export async function POST(req: Request, { params }: { params: Promise<{ agent: string }> }) {
  if (!(await getSession())) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { agent } = await params;
  if (!AGENTS.includes(agent as (typeof AGENTS)[number])) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "campaignId and message are required" }, { status: 400 });
  try {
    await startChat(parsed.data.campaignId, agent as (typeof AGENTS)[number], parsed.data.message.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not start" }, { status: 409 });
  }
}
