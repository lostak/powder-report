// Current base (and summit) depth each resort reports, read from its skiresort.info snow-report page ("46 cm Base",
// "46 cm Mountain", "Updated on: 22 Nov 2026" – resort-reported numbers, monitored daily). Public page, no key; the
// numbers are in the page itself. Cached in state.base for 3 hours so the 5-minute loop stays light.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const inch = cm => Math.round(cm / 2.54);
function parse(html) {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&thinsp;/g, ' ').replace(/\s+/g, ' ');
  const out = {};
  const sec = t.slice(Math.max(0, t.search(/Snow depths/i)));
  const b = sec.match(/(\d+(?:\.\d+)?)\s*cm\s*Base\b/i), m = sec.match(/(\d+(?:\.\d+)?)\s*cm\s*Mountain\b/i);
  if (b) out.base = inch(+b[1]); if (m) out.summit = inch(+m[1]);
  const u = t.match(/Updated on:?\s*(\d{1,2} [A-Z][a-z]{2} \d{4})/); if (u) out.asOf = u[1];
  if (out.base == null && /ski resort closed|Season (?:start|begins)/i.test(t)) out.closed = true;
  return out;
}
async function one(m) {
  if (!m.skiresort) return null;
  const url = `https://www.skiresort.info/ski-resort/${m.skiresort}/snow-report/`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { ...parse(await r.text()), url };
}
// → { 'Winter Park': { base: 18, summit: 18, asOf: '22 Nov 2026', url } … }
async function bases(mountains, state, log = () => {}) {
  state.base ||= {};
  const fresh = state.base.at && state.base.v === 2 && Date.now() - state.base.at < 3 * 3600e3;
  if (!fresh) {
    const got = {};
    for (const m of mountains) {
      try { const b = await one(m); if (b) got[m.name] = b; } catch (e) { log(`base depth ${m.name}: ${e.message.slice(0, 90)}`); }
    }
    if (Object.keys(got).length) state.base = { v: 2, at: Date.now(), by: got };
  }
  return state.base.by || {};
}
// a report older than 3 days isn't "current" (closed resorts keep their last number)
const current = b => { if (!b || b.base == null) return false; if (!b.asOf) return true; return Date.now() - Date.parse(b.asOf + ' 12:00 UTC') < 3 * 864e5; };
const label = b => current(b) ? `base ${b.base}"${b.summit != null && b.summit !== b.base ? ` / summit ${b.summit}"` : ''}` : '';
module.exports = { bases, parse, label, current };
