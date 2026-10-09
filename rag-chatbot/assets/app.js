// Wraps every <pre data-file="..." data-lang="..."> in a titled code card with a copy button,
// then applies highlight.js if it loaded (pages still read fine offline without it).
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
        await navigator.clipboard.writeText(pre.innerText.replace(/\n$/, ""));
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
    const hlLang = { ts: "typescript", tsx: "typescript", sh: "bash", env: "bash", sql: "sql", json: "json" }[lang];
    if (code && hlLang) code.classList.add(`language-${hlLang}`);
  });
  if (window.hljs) window.hljs.highlightAll();
});
