// POST a JSON body and read the Server-Sent Events that come back.
// (The browser's EventSource only does GET requests, so we read the stream ourselves.)
export type Source = { id: string; title: string; score: number };

export type ChatEvent =
  | { event: "input"; data: { allowed: boolean; cleaned: string; reason: string } }
  | { event: "sources"; data: Source[] }
  | { event: "token"; data: string }
  | { event: "output"; data: { allowed: boolean; reason: string; fallback: string | null } }
  | { event: "done"; data: { traceId: string | null; seconds?: number; inputTokens?: number; outputTokens?: number } }
  | { event: "error"; data: string };

export async function postEvents(url: string, body: unknown, onEvent: (e: ChatEvent) => void) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error(`Server answered ${response.status}`);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // Events are separated by a blank line; each has "event: ..." and "data: ..." lines.
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop()!; // the last piece may be incomplete: keep it for the next read
    for (const block of blocks) {
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (event && data !== undefined) onEvent({ event, data: JSON.parse(data) } as ChatEvent);
    }
  }
}
