// POST a JSON body and read the Server-Sent Events that come back.
// (The browser's EventSource only does GET requests, so we read the stream ourselves.)
export type Added = { kind: "input" | "tool_call" | "tool_result" | "answer"; text: string };
export type Step = { step: number; node: string; added: Added[] };

export type GraphEvent =
  | { event: "token"; data: string }
  | { event: "step"; data: Step }
  | { event: "done"; data: Record<string, never> }
  | { event: "error"; data: string };

export async function postEvents(url: string, body: unknown, onEvent: (e: GraphEvent) => void) {
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
      if (event && data !== undefined) onEvent({ event, data: JSON.parse(data) } as GraphEvent);
    }
  }
}
