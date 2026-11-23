// Current base depth each resort reports, read from its OnTheSnow snow-report page (resort-reported numbers, refreshed
// by the resorts each morning). Public pages, no key. Cached in state.base for 3 hours so the 5-minute loop stays light.
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const num = v => (v == null || v === '' || isNaN(+v)) ? null : +v;
// "The Winter Park snow report for Nov 22 is a 24" base depth with 9 of 24 lifts open."
function parse(html) {
  const out = {};
  const d = html.match(/snow report for ([A-Z][a-z]{2} \d{1,2}) is an? (\d+)(?:"|&quot;|″| ?in)\s*base depth/i);
  if (d) { out.base = +d[2]; out.asOf = d[1]; }
  // the page's own data (Next.js): "snow":{..."base":24,"summit":30...} or "base":{"value":24}
  const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nd) {
    try {
      const seen = new Set(), stack = [JSON.parse(nd[1])];
      while (stack.length) {
        const o = stack.pop(); if (!o || typeof o !== 'object' || seen.has(o)) continue; seen.add(o);
        if ('base' in o && ('summit' in o || 'top' in o)) {
          const v = x => num(x && typeof x === 'object' ? x.value ?? x.inches ?? x.amount : x);
          if (out.base == null && v(o.base) != null) out.base = v(o.base);
          if (out.summit == null && v(o.summit ?? o.top) != null) out.summit = v(o.summit ?? o.top);
        }
        for (const k of Object.keys(o)) if (o[k] && typeof o[k] === 'object') stack.push(o[k]);
      }
    } catch { /* page shape changed – the description line still works */ }
  }
  if (out.summit == null) { const s = html.replace(/<[^>]+>/g, ' ').match(/Summit\s+(\d{1,3})(?:"|&quot;|″)/); if (s) out.summit = +s[1]; }
  if (/\bClosed\b/.test(html.replace(/<[^>]+>/g, ' ').slice(0, 20000)) && out.base == null) out.closed = true;
  return out;
}
async function one(m) {
  if (!m.onthesnow) return null;
  const url = `https://www.onthesnow.com/${m.onthesnow}/skireport`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return { ...parse(await r.text()), url };
}
// → { 'Winter Park': { base: 24, summit: 30, asOf: 'Nov 22', url } … }
async function bases(mountains, state, log = () => {}) {
  state.base ||= {};
  const fresh = state.base.at && Date.now() - state.base.at < 3 * 3600e3;
  if (!fresh) {
    const got = {};
    for (const m of mountains) {
      try { const b = await one(m); if (b) got[m.name] = b; } catch (e) { log(`base depth ${m.name}: ${e.message.slice(0, 90)}`); }
    }
    if (Object.keys(got).length) state.base = { at: Date.now(), by: got };
  }
  return state.base.by || {};
}
const label = b => b && b.base != null ? `base ${b.base}"${b.summit != null && b.summit !== b.base ? ` / summit ${b.summit}"` : ''}` : '';
module.exports = { bases, parse, label };
