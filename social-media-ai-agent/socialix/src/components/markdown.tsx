/** A tiny, safe markdown renderer for chat replies: paragraphs, lists, bold, italics, inline code and links. */

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return escape(s)
    .replace(/`([^`]+)`/g, '<code class="rounded bg-gray-100 px-1">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noreferrer">$2</a>');
}

export function Markdown({ text }: { text: string }) {
  const html: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const kind = bullet ? "ul" : "ol";
      if (list !== kind) {
        close();
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline((bullet ?? numbered)![1]!)}</li>`);
    } else if (line.trim() === "") {
      close();
    } else {
      close();
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      html.push(heading ? `<p><strong>${inline(heading[1]!)}</strong></p>` : `<p>${inline(line)}</p>`);
    }
  }
  close();
  return <div className="prose-chat text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html.join("") }} />;
}
