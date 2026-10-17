"""Turn the Markdown docs (docs/*.md) into standalone HTML pages in docs/html/.

Usage: python scripts/docs-html.py      (needs the `markdown` package: pip install markdown)
Each page gets the same navigation bar, light and dark styles, and links rewritten from .md to .html.
"""
import html
import pathlib
import re

import markdown

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
OUT = DOCS / "html"

PAGES = [  # (source, output, short title for the navigation)
    ("README.md", "index.html", "Overview"),
    ("01-setup.md", "01-setup.html", "1. Setup"),
    ("02-start-and-stop.md", "02-start-and-stop.html", "2. Start and stop"),
    ("03-user-guide.md", "03-user-guide.html", "3. User guide"),
    ("04-troubleshooting.md", "04-troubleshooting.html", "4. Troubleshooting"),
    ("05-linux-server.md", "05-linux-server.html", "5. Linux server"),
]
LINKS = {src: out for src, out, _ in PAGES}

CSS = """
:root { --bg:#ffffff; --fg:#1f2328; --muted:#59636e; --line:#d1d9e0; --soft:#f6f8fa; --accent:#4f46e5; --note:#fff8c5; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#0d1117; --fg:#e6edf3; --muted:#9198a1; --line:#3d444d; --soft:#161b22; --accent:#8b8cf8; --note:#2d2a12; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
nav { position:sticky; top:0; z-index:1; display:flex; flex-wrap:wrap; gap:4px 14px; align-items:center;
      padding:10px 16px; background:var(--soft); border-bottom:1px solid var(--line); font-size:14px; }
nav strong { margin-right:8px; }
nav a { color:var(--muted); text-decoration:none; }
nav a.here { color:var(--accent); font-weight:600; }
main { max-width:900px; margin:0 auto; padding:24px 16px 64px; }
h1 { font-size:2em; margin-top:.4em; } h2 { border-bottom:1px solid var(--line); padding-bottom:.3em; margin-top:1.8em; }
a { color:var(--accent); }
code { font:0.88em ui-monospace, SFMono-Regular, Consolas, monospace; background:var(--soft); padding:.15em .35em; border-radius:5px; }
pre { background:var(--soft); border:1px solid var(--line); border-radius:8px; padding:14px; overflow-x:auto; line-height:1.45; }
pre code { background:none; padding:0; font-size:0.85em; }
table { border-collapse:collapse; width:100%; display:block; overflow-x:auto; margin:1em 0; }
th, td { border:1px solid var(--line); padding:6px 12px; text-align:left; vertical-align:top; }
th { background:var(--soft); }
blockquote { margin:1em 0; padding:10px 16px; background:var(--note); border-left:4px solid var(--accent); border-radius:6px; }
blockquote p { margin:.3em 0; }
img { max-width:100%; height:auto; border:1px solid var(--line); border-radius:8px; }
li > input[type=checkbox] { margin-right:6px; }
.pager { display:flex; justify-content:space-between; gap:12px; margin-top:48px; padding-top:16px; border-top:1px solid var(--line); }
.pager a { text-decoration:none; }
"""


def convert(md_text: str) -> str:
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists"], output_format="html")
    # links between the docs: foo.md -> foo.html (keeps #anchors)
    body = re.sub(r'href="([^"#:]+\.md)(#[^"]*)?"', lambda m: f'href="{LINKS.get(m.group(1), m.group(1)[:-3] + ".html")}{m.group(2) or ""}"', body)
    # images live in docs/images, one level up from docs/html
    body = re.sub(r'src="images/', 'src="../images/', body)
    # GitHub-style task lists: "[ ] item" -> a disabled checkbox
    body = re.sub(r"<li>\[ \]\s*", '<li><input type="checkbox" disabled>', body)
    body = re.sub(r"<li>\[x\]\s*", '<li><input type="checkbox" checked disabled>', body, flags=re.I)
    return body


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for i, (src, out, short) in enumerate(PAGES):
        text = (DOCS / src).read_text(encoding="utf-8")
        title = re.search(r"^#\s+(.+)$", text, re.M).group(1).strip()
        nav = "".join(f'<a href="{o}"{" class=here" if o == out else ""}>{html.escape(s)}</a>' for _, o, s in PAGES)
        prev_ = f'<a href="{PAGES[i - 1][1]}">&larr; {html.escape(PAGES[i - 1][2])}</a>' if i else "<span></span>"
        next_ = f'<a href="{PAGES[i + 1][1]}">{html.escape(PAGES[i + 1][2])} &rarr;</a>' if i + 1 < len(PAGES) else "<span></span>"
        page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · Socialix docs</title>
<style>{CSS}</style>
</head>
<body>
<nav><strong>Socialix docs</strong>{nav}</nav>
<main>
{convert(text)}
<div class="pager">{prev_}{next_}</div>
</main>
</body>
</html>
"""
        (OUT / out).write_text(page, encoding="utf-8", newline="\n")
        print("wrote", (OUT / out).relative_to(ROOT))


if __name__ == "__main__":
    main()
