// My Life – light/dark theme. Loaded in <head> so the page never flashes the wrong colors.
// Remembers the choice on this device; until you pick one it follows the system setting.
(() => {
  const KEY = "life.theme", root = document.documentElement;
  const saved = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const sys = () => (window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  const apply = (t) => { root.dataset.theme = t; const b = document.getElementById("themeBtn"); if (b) { b.textContent = t === "light" ? "🌙" : "☀️"; b.title = t === "light" ? "Switch to dark" : "Switch to light"; } };
  apply(saved() || sys());
  if (window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (!saved()) apply(sys()); });
  const addButton = () => {
    const ref = document.getElementById("refresh"); if (!ref || document.getElementById("themeBtn")) return;
    const b = document.createElement("button"); b.id = "themeBtn"; b.className = "g themebtn"; ref.before(b); ref.before(document.createTextNode(" "));
    b.onclick = () => { const t = root.dataset.theme === "light" ? "dark" : "light"; try { localStorage.setItem(KEY, t); } catch {} apply(t); };
    apply(root.dataset.theme);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
})();
