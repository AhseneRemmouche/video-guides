// Wraps every <pre data-file="..." data-lang="..."> in a titled code card with a copy button,
// numbers the lines (so "Line by line" tables can be followed), then applies highlight.js if it
// loaded (pages still read fine offline without it).
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("pre[data-file], pre[data-lang]").forEach((pre) => {
    const card = document.createElement("div");
    card.className = "code";
    const bar = document.createElement("div");
    bar.className = "bar";
    const label = document.createElement("span");
    const file = pre.dataset.file || "";
    const lang = pre.dataset.lang || "";
    label.innerHTML = file
      ? `${file}${pre.dataset.tag ? ` <span class="tag">· ${pre.dataset.tag}</span>` : ""}`
      : lang;
    const btn = document.createElement("button");
    btn.className = "copy";
    btn.type = "button";
    btn.textContent = "Copy";
    btn.addEventListener("click", async () => {
      try {
        const src = pre.querySelector("code") || pre; // the code only, not the line numbers
        await navigator.clipboard.writeText(src.innerText.replace(/\n$/, ""));
        btn.textContent = "Copied!";
      } catch {
        btn.textContent = "Select & copy";
      }
      setTimeout(() => (btn.textContent = "Copy"), 1500);
    });
    bar.append(label, btn);
    pre.parentNode.insertBefore(card, pre);
    card.append(bar, pre);

    const code = pre.querySelector("code");
    const hlLang = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", sh: "bash", ps: "powershell",
      env: "bash", sql: "sql", json: "json", py: "python", toml: "ini", yaml: "yaml", css: "css", html: "xml",
    }[lang];
    if (code && hlLang) code.classList.add(`language-${hlLang}`);
    if (code) addLineNumbers(pre, code);
  });
  if (window.hljs) window.hljs.highlightAll();
});

// Line numbers in a gutter beside the code. Full files start at 1. An excerpt whose tag names one
// range ("lines 42–59") starts at 42; other excerpts and "changed lines" snippets get no numbers,
// because their table rows use the real file's line numbers. data-start="N" overrides.
function addLineNumbers(pre, code) {
  const lines = code.textContent.replace(/\n$/, "").split("\n").length;
  if (lines < 2) return;
  const tag = (pre.dataset.tag || "").toLowerCase();
  const range = tag.match(/lines? (\d+)\s*[–-]\s*(\d+)/);
  const oneRange = range && +range[2] - +range[1] + 1 === lines && !/(,| and )\s*\d/.test(tag);
  let start = 1;
  if (pre.dataset.start) start = +pre.dataset.start;
  else if (oneRange) start = +range[1];
  else if (/excerpt|changed lines|shortened/.test(tag)) return;
  const gutter = document.createElement("span");
  gutter.className = "ln";
  gutter.setAttribute("aria-hidden", "true");
  gutter.textContent = Array.from({ length: lines }, (_, i) => start + i).join("\n");
  pre.classList.add("numbered");
  pre.insertBefore(gutter, code);
}
