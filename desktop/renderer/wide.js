// My Life – wide-screen layout helper: wraps each section heading with the cards under it in a .grp block so the
// wide layout (wide.css) can flow whole groups into columns. Harmless on phones (the blocks just stack as before).
(() => {
  const group = (sec) => {
    const kids = [...sec.children];
    if (!kids.some(k => k.tagName === "H2")) return;
    let g = null;
    for (const k of kids) {
      if (k.classList && k.classList.contains("grp")) { g = null; continue; }
      if (k.tagName === "H2" || !g) { g = document.createElement("div"); g.className = "grp"; sec.insertBefore(g, k); }
      g.appendChild(k);
    }
  };
  const watch = (sec) => { group(sec); new MutationObserver(() => group(sec)).observe(sec, { childList: true }); };
  const start = () => {
    document.querySelectorAll("section[id^='tab-']").forEach(watch);
    const nav = document.querySelector("nav .in");                       // the sidebar's name (hidden on phones)
    if (nav && !nav.querySelector(".brand")) { const b = document.createElement("div"); b.className = "brand"; b.innerHTML = "My <span>Life</span>"; nav.prepend(b); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
