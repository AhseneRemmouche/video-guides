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
  setupLanguageTabs();
});

// Bilingual guides: <div class="code-tabs"> holds one Python and one TypeScript block. They become
// one card with a Python | TypeScript switch. One choice drives every group on the page and every
// element marked data-only="py" / data-only="ts", and is remembered between pages when storage works.
const LANGS = { py: "Python", ts: "TypeScript" };
const langKey = (lang) => (lang === "py" ? "py" : /^(ts|tsx|js|jsx)$/.test(lang) ? "ts" : null);

function setupLanguageTabs() {
  const groups = document.querySelectorAll(".code-tabs");
  if (!groups.length && !document.querySelector("[data-only]")) return;
  groups.forEach((group) => {
    const strip = document.createElement("div");
    strip.className = "lang-strip";
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "Code language");
    group.querySelectorAll(":scope > .code").forEach((card) => {
      const key = langKey(card.querySelector("pre")?.dataset.lang || "");
      if (!key) return;
      card.dataset.langKey = key;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.langKey = key;
      btn.textContent = LANGS[key];
      btn.addEventListener("click", () => setLanguage(key, true));
      strip.append(btn);
    });
    group.prepend(strip);
  });
  // The same switch at the top of the page, so the choice is visible before the first code block.
  const hero = document.querySelector(".hero");
  if (hero) {
    const top = document.createElement("div");
    top.className = "lang-strip page-lang";
    top.setAttribute("role", "group");
    top.setAttribute("aria-label", "Code language for this guide");
    const label = document.createElement("span");
    label.textContent = "Code in:";
    top.append(label);
    for (const key of Object.keys(LANGS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.langKey = key;
      btn.textContent = LANGS[key];
      btn.addEventListener("click", () => setLanguage(key, true));
      top.append(btn);
    }
    hero.append(top);
  }
  let saved = null;
  try { saved = localStorage.getItem("guide-code-lang"); } catch {}
  setLanguage(saved === "ts" ? "ts" : "py", false);
}

function setLanguage(key, remember) {
  document.documentElement.dataset.codeLang = key;
  document.querySelectorAll(".code-tabs > .code").forEach((card) => (card.hidden = card.dataset.langKey !== key));
  document.querySelectorAll(".lang-strip button").forEach((b) =>
    b.setAttribute("aria-pressed", String(b.dataset.langKey === key)));
  if (remember) try { localStorage.setItem("guide-code-lang", key); } catch {}
}

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
