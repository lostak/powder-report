// Powder report. Every run: (1) 7-day snowfall forecast per mountain from the National Weather Service grid,
// (2) overnight new snow from the nearest SNOTEL station (USDA), and posts urgent Slack alerts when thresholds hit.
// Read-only public data, no keys. State (what was already alerted) lives in state/state.json.
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('mountains.json', 'utf8'));
const STATE = 'state/state.json';
const DRY = process.argv.includes('--dry');
const REPORT = process.argv.includes('--report');   // post the full snow report (every mountain, 7 days + overnight) regardless of thresholds
const DEBUG = process.argv.includes('--debug') || process.env.DEBUG === '1';
const TZ = cfg.timezone || 'America/Denver';
const T = cfg.thresholds, Q = cfg.quietHours;
const UA = 'powder-report (github.com/lostak/powder-report)';
const log = (...a) => console.log(...a);
const dbg = (...a) => { if (DEBUG) console.log('  [debug]', ...a); };
const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { grid: {}, alerts: {}, powderDays: {}, snotel: null };

const gcal = require('./gcal');   // Bradley's calendar: PASSES/MOUNTAINS from "Personal: life settings"; alert events for the app and morning brief
let mountains = cfg.mountains.filter(m => (cfg.passes || []).includes(m.pass) || (cfg.extra || []).includes(m.name));
const calEvent = async (summary, description) => { if (DRY || !gcal.ready) return; try { await gcal.insert({ summary, description, when: gcal.nextQuarter() }); } catch (e) { log('Calendar event failed: ' + e.message.slice(0, 120)); } };
const localParts = (d = new Date()) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(d).map(x => [x.type, x.value])); return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour + (+p.minute) / 60, weekday: p.weekday }; };
const now = localParts();
const addDays = (dateStr, n) => { const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = dateStr => new Date(dateStr + 'T12:00:00Z').getUTCDay();
const nice = dateStr => new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const inQuiet = (from, to) => (from > to) ? (now.hour >= from || now.hour < to) : (now.hour >= from && now.hour < to);
const rnd = x => Math.round(x * 10) / 10;

async function getJSON(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, application/geo+json', ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url.slice(0, 90)}`);
  return r.json();
}

// ---------- NWS forecast: inches per "ski day" (snow from 6 PM the evening before through 6 PM) ----------
async function forecastFor(m) {
  const key = `${m.lat},${m.lng}`;
  if (!state.grid[key]) { const pt = await getJSON(`https://api.weather.gov/points/${m.lat},${m.lng}`); state.grid[key] = pt.properties.forecastGridData; }
  const g = await getJSON(state.grid[key]);
  const vals = (g.properties.snowfallAmount && g.properties.snowfallAmount.values) || [];
  const days = {};
  for (const v of vals) {
    const [start, dur] = v.validTime.split('/');
    const hours = +(dur.match(/(\d+)H/) || [0, 1])[1] + 24 * +(dur.match(/P(\d+)D/) || [0, 0])[1];
    const inches = (v.value || 0) / 25.4;
    for (let h = 0; h < Math.max(1, hours); h++) {
      const t = new Date(new Date(start).getTime() + h * 3600e3), lp = localParts(t);
      const day = lp.hour >= 18 ? addDays(lp.date, 1) : lp.date;
      days[day] = (days[day] || 0) + inches / Math.max(1, hours);
    }
  }
  return days;
}

// ---------- SNOTEL: overnight new snow = rise in snow depth over the last 24 h at the nearest station ----------
const miles = (a, b) => { const r = Math.PI / 180, dl = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) / 2 * r), dp = (b.lat - a.lat) * r; return 3959 * Math.sqrt(dl * dl + dp * dp); };
async function snotelStations() {
  if (state.snotel && Date.now() - state.snotel.at < 30 * 864e5) return state.snotel.list;
  const list = await getJSON('https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations?stationTriplets=*:CO:SNTL&activeOnly=true');
  state.snotel = { at: Date.now(), list: list.map(s => ({ id: s.stationTriplet, name: s.name, lat: s.latitude, lng: s.longitude, elev: s.elevation })) };
  return state.snotel.list;
}
async function overnightSnow(ms) {
  const stations = await snotelStations();
  const pick = {};
  for (const m of ms) { const best = stations.map(s => ({ s, d: miles(m, s) })).sort((a, b) => a.d - b.d)[0]; if (best && best.d <= 15) pick[m.name] = best; }
  const ids = [...new Set(Object.values(pick).map(x => x.s.id))];
  if (!ids.length) return {};
  const end = new Date(), begin = new Date(end.getTime() - 30 * 3600e3);
  const f = d => d.toISOString().slice(0, 16).replace('T', ' ');
  const data = await getJSON(`https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?stationTriplets=${encodeURIComponent(ids.join(','))}&elements=SNWD&duration=HOURLY&beginDate=${encodeURIComponent(f(begin))}&endDate=${encodeURIComponent(f(end))}&periodRef=END`);
  const depth = {};
  for (const row of data) for (const el of row.data || []) {
    const vals = (el.values || []).filter(v => v.value != null).map(v => ({ t: v.date, v: +v.value })).sort((a, b) => a.t.localeCompare(b.t));
    if (vals.length < 2) continue;
    const last = vals[vals.length - 1];
    const dayAgo = vals.filter(v => new Date(v.t.replace(' ', 'T') + 'Z') <= new Date(new Date(last.t.replace(' ', 'T') + 'Z').getTime() - 24 * 3600e3));
    const base = dayAgo.length ? Math.min(...dayAgo.slice(-6).map(v => v.v)) : Math.min(...vals.map(v => v.v));
    depth[row.stationTriplet] = { newSnow: Math.max(0, last.v - base), depth: last.v, at: last.t };
  }
  const out = {};
  for (const [name, { s, d }] of Object.entries(pick)) if (depth[s.id]) out[name] = { ...depth[s.id], station: s.name, miles: Math.round(d) };
  return out;
}

// Post to Slack (SLACK_WEBHOOK_URL) and Discord (DISCORD_WEBHOOK_URL) when set. Slack *bold* becomes Discord **bold**.
async function slack(text) {
  if (DRY) { log('  (dry) would post:\n' + text.split('\n').map(l => '    ' + l).join('\n')); return; }
  const s = process.env.SLACK_WEBHOOK_URL, d = process.env.DISCORD_WEBHOOK_URL;
  if (!s && !d) throw new Error('SLACK_WEBHOOK_URL / DISCORD_WEBHOOK_URL not set');
  const post = async (url, body, name) => { if (!url) return; const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(name + ' post failed ' + r.status); };
  await post(s, { text }, 'Slack');
  await post(d, { content: text.replace(/\*([^*\n]+)\*/g, '**$1**').slice(0, 1990) }, 'Discord');
}

(async () => {
  const errors = [], summary = [];
  if (gcal.ready) {   // app Settings → which mountains: PASSES line (ikon/epic/local/all) and/or MOUNTAINS line (names)
    try {
      const st = await gcal.findByTitle('Personal: life settings', 'life settings', { back: 730 });
      const d = st ? st.description || '' : '';
      const passes = ((d.match(/^\s*PASSES:\s*(.+)$/m) || [])[1] || '').toLowerCase();
      const names = ((d.match(/^\s*MOUNTAINS:\s*(.+)$/m) || [])[1] || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
      const byPass = passes ? cfg.mountains.filter(m => passes.includes('all') || passes.includes(m.pass)) : [];
      const byName = names.length ? cfg.mountains.filter(m => names.some(n => m.name.toLowerCase().includes(n) || n.includes(m.name.toLowerCase()) || (m.aliases || []).some(a => n.includes(a)))) : [];
      const chosen = [...new Map([...byPass, ...byName].map(m => [m.name, m])).values()];
      if (chosen.length) { mountains = chosen; log(`Mountains from calendar settings (${passes || 'passes unset'}): ${mountains.map(m => m.name).join(', ')}`); }
      const missing = names.filter(n => !cfg.mountains.some(m => m.name.toLowerCase().includes(n) || n.includes(m.name.toLowerCase()) || (m.aliases || []).some(a => n.includes(a))));
      if (missing.length) log('No forecast point configured for: ' + missing.join(', '));
    } catch (e) { log('Calendar settings read failed: ' + e.message.slice(0, 120)); }
  }
  // 1) forecasts
  const fc = {};
  for (const m of mountains) { try { fc[m.name] = await forecastFor(m); } catch (e) { errors.push(`${m.name} forecast: ${e.message.slice(0, 80)}`); } }
  const horizon = [...Array(8)].map((_, i) => addDays(now.date, i));
  const line = m => horizon.map(d => `${nice(d).slice(0, 3)} ${rnd(fc[m.name]?.[d] || 0)}`).join(' · ');
  for (const m of mountains) if (fc[m.name]) dbg(`${m.name}: ${line(m)}`);
  // the coming weekend (today if Sat/Sun counts as "this weekend")
  const sat = horizon.find(d => dow(d) === 6) || addDays(now.date, 7 - ((dow(now.date) + 1) % 7)), sun = addDays(sat, 1);
  const storms = []; // { key, label, best:{name,in}, perMountain:{} }
  const wk = {}; for (const m of mountains) if (fc[m.name]) wk[m.name] = (fc[m.name][sat] || 0) + (fc[m.name][sun] || 0);
  const wkBest = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
  if (wkBest && wkBest[1] >= T.bigWeekendInches) storms.push({ key: sat, label: `${nice(sat)} weekend`, best: { name: wkBest[0], in: wkBest[1] }, per: wk });
  for (const d of horizon.slice(0, 8)) {
    if (dow(d) === 0 || dow(d) === 6) continue;
    const per = {}; for (const m of mountains) if (fc[m.name]) per[m.name] = fc[m.name][d] || 0;
    const best = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= T.majorWeekdayInches) storms.push({ key: d, label: nice(d), best: { name: best[0], in: best[1] }, per });
  }
  for (const k of Object.keys(state.alerts)) if (k < addDays(now.date, -1)) delete state.alerts[k];
  for (const s of storms) {
    const prev = state.alerts[s.key];
    if (prev && s.best.in < prev.in + T.reAlertInches) continue;
    if (inQuiet(Q.forecastFrom, Q.forecastTo)) { summary.push(`holding forecast alert for ${s.label} until morning`); continue; }
    const rows = Object.entries(s.per).filter(([, v]) => v >= 1).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${rnd(v)}"`).join(' · ');
    await slack(`🚨 *POWDER ${prev ? 'UPDATE' : 'ALERT'} – ${s.label} – ${s.best.name} ${Math.round(s.best.in)}"*\n*Forecast (NWS):* ${rows}\n_Overnight snow counts toward the next day. Check the resort report the morning of._`);
    state.alerts[s.key] = { in: s.best.in, at: new Date().toISOString() };
    summary.push(`alerted ${s.label}: ${s.best.name} ${rnd(s.best.in)}"`);
    await calEvent(`Personal: powder alert${prev ? ' UPDATE' : ''} – ${s.label} – ${s.best.name} ${Math.round(s.best.in)}"`, `FORECAST: ${s.best.name} ${rnd(s.best.in)}"\n${rows}\nBEST DAY TO GO: ${s.label}\nPOWDER-ALERT: ${s.key}\nSource: NWS gridpoint snowfall`);
  }
  // 2) overnight new snow (powder day)
  let obs = {};
  try { obs = await overnightSnow(mountains); } catch (e) { errors.push(`SNOTEL: ${e.message.slice(0, 80)}`); }
  for (const [n, o] of Object.entries(obs)) dbg(`${n}: +${rnd(o.newSnow)}" (depth ${o.depth}" at ${o.station}, ${o.miles} mi, ${o.at})`);
  const pow = Object.entries(obs).filter(([, o]) => o.newSnow >= T.powderDayInches).sort((a, b) => b[1].newSnow - a[1].newSnow);
  for (const k of Object.keys(state.powderDays)) if (k < addDays(now.date, -2)) delete state.powderDays[k];
  if (pow.length && !state.powderDays[now.date] && !inQuiet(Q.powderDayFrom, Q.powderDayTo)) {
    const [top, o] = pow[0];
    const rows = Object.entries(obs).filter(([, x]) => x.newSnow >= 3).sort((a, b) => b[1].newSnow - a[1].newSnow).map(([n, x]) => `${n} +${Math.round(x.newSnow)}"`).join(' · ');
    const link = (mountains.find(m => m.name === top) || {}).snowReport || '';
    await slack(`🚨 *POWDER DAY – ${top} ${Math.round(o.newSnow)}" OVERNIGHT*\n*Snow stake nearest each mountain (SNOTEL, last 24 h):* ${rows}\n${link}\n_Confirm on the resort's snow report, then go._`);
    state.powderDays[now.date] = { top, in: o.newSnow };
    summary.push(`powder day: ${top} +${rnd(o.newSnow)}"`);
    await calEvent(`Personal: powder day – ${top} ${Math.round(o.newSnow)}" overnight`, `${rows}\n${link}\nPOWDER-DAY: ${now.date}\nSource: SNOTEL snow depth change, last 24 h`);
  }
  // 2b) full report on demand (Pocket / Discord "snow report") or on the daily schedule
  // Daily report: the first run after 6 AM each day (robust to late/missed runs), or on demand (--report).
  const hourNow = +new Date().toLocaleString('en-US', { timeZone: 'America/Denver', hour: 'numeric', hour12: false }) % 24;
  const dailyDue = !DRY && hourNow >= 6 && hourNow < 21 && state.lastReport !== now.date;
  if (REPORT || dailyDue) {
    if (!DRY) state.lastReport = now.date;
    const days = horizon.slice(0, 7);
    const rows = mountains.filter(m => fc[m.name]).map(m => `${m.name}: ${days.map(d => `${nice(d).slice(0, 3)} ${rnd(fc[m.name][d] || 0)}`).join(' · ')}${obs[m.name] ? ` | overnight +${rnd(obs[m.name].newSnow)}"` : ''}`);
    const best = mountains.filter(m => fc[m.name]).map(m => ({ n: m.name, w: (fc[m.name][sat] || 0) + (fc[m.name][sun] || 0) })).sort((a, b) => b.w - a.w)[0];
    await slack(`❄️ *Snow report – ${nice(now.date)}* (inches, NWS forecast per ski day; overnight from the nearest SNOTEL)\n${rows.join('\n')}\n*Weekend pick:* ${best ? `${best.n} ${rnd(best.w)}" Sat+Sun` : '–'}${errors.length ? `\n(couldn't read: ${errors.map(e => e.split(':')[0]).join(', ')})` : ''}`);
    summary.push('full report posted');
  }
  // 3) errors (once a day at most)
  if (errors.length && !DRY && process.env.SLACK_WEBHOOK_URL && !Object.keys(fc).length && state.lastErrorDay !== now.date) {
    await slack('⚠️ Powder report could not read any forecasts: ' + errors.join('; ')); state.lastErrorDay = now.date;
  }
  const most = mountains.filter(m => fc[m.name]).map(m => ({ n: m.name, v: Math.max(...horizon.map(d => fc[m.name][d] || 0)) })).sort((a, b) => b.v - a.v)[0];
  log(`forecasts: ${Object.keys(fc).length}/${mountains.length} mountains; snotel: ${Object.keys(obs).length}; ${summary.join('; ') || 'nothing to alert'}; most in 7 days: ${most ? `${most.n} ${rnd(most.v)}"` : '–'}; errors: ${errors.join('; ') || 'none'}`);
  fs.mkdirSync('state', { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
