// My Life: bet history page + bet slip uploads.
// Two histories: "Your bets" = only what Bradley actually placed (pick lines marked "placed: yes" plus SLIP lines from his
// uploaded slips; these move the bankroll) and "All picks" = every recommendation, in units.
// History comes from the calendar's "Personal: picks log" (graded by the betting task), archived in the private
// per-person db so it outlasts the log's 30-day window. Slip screenshots are uploaded as assets, read by Claude,
// and the actual bets are written back to the picks log as "SLIP:" lines so the grading task uses the real price/stake.
// Loaded after life-ext.js; shares its globals (esc, $, LOGS, TABS, sample, cloudGet, cloudSet, updateEvent, openFull, toast, TZ).
(() => { const st = document.createElement("style"); st.textContent = `
  .bh-chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
  .bh-chips button{padding:5px 11px;font-size:12.5px;border-radius:99px;background:var(--panel2);color:var(--mute)}
  .bh-chips button.on{background:var(--btn);color:#fff}
  .bh-day{font:700 13px/1 "Barlow Condensed",sans-serif;letter-spacing:.5px;text-transform:uppercase;color:var(--mute);margin:14px 2px 4px}
  .bh-row{display:grid;grid-template-columns:34px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}
  .bh-row:first-child{border-top:0}
  .bh-res{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font:700 15px/1 "Barlow Condensed";background:var(--panel2);color:var(--mute)}
  .bh-res.W{background:rgba(94,224,160,.15);color:var(--good)} .bh-res.L{background:rgba(255,123,123,.15);color:var(--bad)} .bh-res.P{color:var(--warn)}
  .bh-bet{font-size:14px;line-height:1.3} .bh-sub{color:var(--mute);font-size:12px;margin-top:2px}
  .bh-pl{text-align:right;font:700 16px/1.1 "Barlow Condensed"} .bh-pl small{display:block;color:var(--mute);font:400 11px Inter,sans-serif}
  .bh-pl.up{color:var(--good)} .bh-pl.dn{color:var(--bad)}
  .bh-slips{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
  .bh-slips img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--panel2)}
  .bh-thumb{width:26px;height:34px;object-fit:cover;border-radius:5px;vertical-align:middle;margin-left:6px;border:1px solid var(--line)}
  .bh-tbl{width:100%;border-collapse:collapse;font-size:13px} .bh-tbl td{padding:5px 2px;border-top:1px solid var(--line)} .bh-tbl td:not(:first-child){text-align:right}
  .bh-big img{width:100%;border-radius:12px;margin-top:8px}
  .bh-chart{width:100%;height:120px;display:block;margin-top:8px}
  .bh-list{margin:8px 0 0;padding-left:16px;color:var(--mute);font-size:13px;line-height:1.45} .bh-list li{margin:2px 0} .bh-list li::marker{color:var(--gold,var(--acc))}
  .bh-k{font-weight:700;font-size:13px;color:var(--ink);margin-top:10px}
  .bh-place{margin-top:6px;padding:4px 10px;font-size:12px;border-radius:99px}
  .bh-pbox{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px;font-size:12.5px}
  .bh-pbox label{display:flex;align-items:center;gap:6px;cursor:pointer} .bh-pbox input[type=checkbox]{width:18px;height:18px;accent-color:var(--good)}
  .bh-pbox .bh-mine{color:var(--good)} .bh-pbox button{padding:3px 9px;font-size:12px;border-radius:99px}
  .bh-ed{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:6px} .bh-ed label{display:flex;flex-direction:column;font-size:11px;color:var(--mute);gap:3px}
  .bh-ed input{width:78px;padding:6px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font-size:14px}
  .bh-ed button{padding:6px 12px;font-size:12.5px;border-radius:99px}`; document.head.append(st); })();

const BH = { rows: {}, slips: [], loaded: false, filter: "all", sport: "all", view: "mine" };
// a bet counts as yours only when the log says you placed it, or it came from one of your slips
const bhMine = (r) => r.slip || r.placed === "yes";
const bhPlacedLabel = (r) => r.slip ? "" : r.placed === "yes" ? '<span class="pill good">placed</span>' : r.placed === "slip" ? '<span class="pill good">placed (see slip)</span>' : r.placed === "no" ? '<span class="pill">not placed</span>' : r.placed === "not yet" ? '<span class="pill">no slip yet</span>' : "";
const bhKey = (r) => (r.date + "|" + r.bet).toLowerCase().replace(/[^a-z0-9|+.-]/g, "");
const bhLocal = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem("life.bh." + k) || "null"); localStorage.setItem("life.bh." + k, JSON.stringify(v)); } catch { return null; } };
let bhAssets = null;
window.claude?.use?.("assets").then(a => { bhAssets = a; }).catch(() => {});

// the pick's line: the number of a total ("Over 44.5" → 44.5) or a spread ("Pittsburgh -3.5 vs …" → -3.5); none for ML
function bhLineOf(bet) {
  const b = String(bet).replace(/\([^)]*\)/g, ""), t = b.match(/\b(?:Over|Under)\s+(\d+(?:\.\d+)?)/i);
  if (t) return t[1]; if (/\bML\b|moneyline/i.test(b)) return null;
  return (b.match(/\s([+-]\d+(?:\.\d+)?)\b/) || [])[1] || null;
}
function bhParseLog(desc) {
  const rows = [];
  for (const raw of String(desc || "").split("\n")) {
    const l = raw.trim(); const m = l.match(/^(SLIP:\s*)?(\d{4}-\d{2}-\d{2})\s*\|/); if (!m) continue;
    const p = l.replace(/^SLIP:\s*/, "").split(" | ").map(s => s.trim());
    const slip = !!m[1], bet = p[1] || "", parlay = /^PARLAY:/i.test(bet) || /parlay/i.test(bet) && slip;
    const find = (re) => p.find(x => re.test(x)) || "";
    const res = find(/^result:/i), close = find(/^close:/i), stake = find(/^\d+(\.\d+)?u\b/) || find(/^\$\d/);
    const slipSt = slip ? (p.slice(4).find(x => /^(open|won|lost|push|void|cashed out)\b/i.test(x)) || "open") : "";
    const st = slip ? slipSt.match(/^(open|won|lost|push|void|cashed out)/i)[1].toLowerCase() : ((res.match(/result:\s*(pending|Push|void|W|L|P)\b/i) || [])[1] || "pending");
    const placed = slip ? "yes" : ((find(/^placed:/i).match(/^placed:\s*(not yet|yes|slip|no)/i) || [])[1] || "").toLowerCase() || null;
    const status = /^(W|won)$/i.test(st) ? "W" : /^(L|lost)$/i.test(st) ? "L" : /^(P|push|void)$/i.test(st) ? "P" : "pending";
    const units = parseFloat((res.match(/([+-]\d+(?:\.\d+)?)u/) || [])[1]);
    const dm = (slip ? slipSt : res).match(/([+-])\$(\d+(?:\.\d+)?)/);
    const slipStake = slip ? ((p[3] || "").match(/\$(\d+(?:\.\d+)?)/) || [])[1] : null;
    const sport = (bet.match(/\((CFB|NFL|NHL|NBA|CBB|MLB|TT)\b/i) || [])[1]?.toUpperCase() || (/table tennis|setka|liga pro/i.test(bet) ? "TT" : parlay ? "Parlay" : "Other");
    const pf = find(/^placed:/i), yLine = (pf.match(/your line ([+-]?\d+(?:\.\d+)?)/i) || [])[1] || null, yOdds = (pf.match(/your odds ([+-]\d+)/i) || [])[1] || null;
    rows.push({ yLine, yOdds, line: slip || parlay ? null : bhLineOf(bet), date: m[2], slip, parlay, bet: bet.replace(/^PARLAY:\s*/i, ""), price: (p[2] || "").split(" ")[0], priceNote: (p[2] || "").replace(/^\S+\s*/, ""),
      book: p[3] || "", conf: (find(/^(Low|Medium|High)/i).match(/^(Low|Medium|High)(-\w+)?/i) || [""])[0],
      stakeU: slip ? null : parseFloat(stake) || null, stake$: slip ? parseFloat(slipStake) || null : parseFloat((stake.match(/\$(\d+(?:\.\d+)?)/) || [])[1]) || null, placed,
      status, units: isNaN(units) ? null : units, dollars: dm && (slip || placed === "yes") ? (dm[1] === "-" ? -1 : 1) * parseFloat(dm[2]) : slip && /^push/i.test(slipSt) ? 0 : null,
      clv: /(did not|didn't|missed|worse than|lost to) (beat )?(the )?close/i.test(close) ? false : /beat (the )?close/i.test(close) ? true : null,
      close: close.replace(/^close:\s*/i, ""), result: slip ? slipSt : res.replace(/^result:\s*/i, ""), sport, start: find(/\d{1,2}:\d{2} [AP]M/) });
  }
  return rows;
}
function bhHeader(desc) {
  const d = String(desc || ""); const g = (re) => (d.match(re) || [])[1] || "";
  return { placedBank: g(/placed bankroll \$([\d.,]+)/i), bankroll: g(/current \$([\d.,]+)/i), unit: g(/unit \$([\d.,]+)/i), mine: g(/^YOUR BETS[^:]*:\s*(.+)$/m), picks: g(/^PICKS RECORD[^:]*:\s*(.+)$/m) || g(/SEASON TOTALS:\s*(.+)/), clv: g(/^CLV:\s*(.+)$/m) };
}
async function bhLoad() {
  if (!BH.loaded) {
    const [r, s] = await Promise.all([cloudGet("betrows"), cloudGet("betslips")]);
    BH.rows = r?.rows || bhLocal("rows") || {}; BH.slips = s?.items || bhLocal("slips") || []; BH.loaded = true;
  }
  const log = LOGS["Personal: picks log"]; let changed = false;
  const unit = parseFloat(bhHeader(log?.description).unit) || 2;
  const archived = (typeof ARCHIVES !== "undefined" ? ARCHIVES : []).flatMap(e => bhParseLog(e.description));
  for (const row of [...archived, ...bhParseLog(log?.description)]) {
    if (row.slip) { row.stakeU = row.stake$ ? Math.round(row.stake$ / unit * 100) / 100 : null; row.units = row.dollars !== null ? Math.round(row.dollars / unit * 100) / 100 : null; }
    const k = (row.slip ? "slip|" : "") + bhKey(row); if (JSON.stringify(BH.rows[k]) !== JSON.stringify(row)) { BH.rows[k] = row; changed = true; } }
  if (changed) { bhLocal("rows", BH.rows); cloudSet("betrows", { rows: BH.rows, at: Date.now() }); }
}
const bhSlipUrl = (s) => s.url || "/_blob/" + s.assetId;
function bhSlipFor(row) {
  const words = row.bet.toLowerCase().match(/[a-z]{4,}/g) || [];
  return BH.slips.find(s => (s.bets || []).some(b => b.date === row.date && words.some(w => String(b.bet).toLowerCase().includes(w))));
}
function bhStats(rows) {
  const g = rows.filter(r => r.status !== "pending"), sum = (a, f) => a.reduce((t, r) => t + (f(r) || 0), 0);
  const rec = (a) => `${a.filter(r => r.status === "W").length}-${a.filter(r => r.status === "L").length}${a.some(r => r.status === "P") ? "-" + a.filter(r => r.status === "P").length : ""}`;
  const risk = sum(g, r => r.stakeU), u = sum(g, r => r.units), d = sum(g, r => r.dollars), risk$ = sum(g, r => r.stake$);
  const c = rows.filter(r => r.clv !== null);
  return { n: rows.length, graded: g.length, rec: rec(g), units: u, dollars: d, roi: risk ? u / risk * 100 : null, roi$: risk$ ? d / risk$ * 100 : null, clv: c.length ? `${c.filter(r => r.clv).length}/${c.length}` : "–", pending: rows.length - g.length };
}
const fmtU = (u) => (u > 0 ? "+" : "") + (Math.round(u * 100) / 100) + "u";
const fmtD = (d) => (d < 0 ? "-$" : "+$") + Math.abs(d).toFixed(2);
function bhChart(rows, money) {
  const f = money ? "dollars" : "units", fmt = money ? fmtD : fmtU;
  const g = rows.filter(r => r.status !== "pending" && r[f] !== null).sort((a, b) => a.date.localeCompare(b.date));
  if (g.length < 2) return "";
  let c = 0; const pts = [0, ...g.map(r => (c += r[f]))]; const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
  const X = (i) => 6 + i * (288 / (pts.length - 1)), Y = (v) => 110 - (v - lo) / span * 100;
  const last = pts[pts.length - 1];
  return `<svg class="bh-chart" viewBox="0 0 300 120" preserveAspectRatio="none"><line x1="0" x2="300" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--line)" stroke-dasharray="3 3"/>
    <polyline fill="none" stroke="${last >= 0 ? "var(--good)" : "var(--bad)"}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${pts.map((v, i) => X(i) + "," + Y(v)).join(" ")}"/></svg>
    <div class="when">Running ${money ? "profit" : "units"}, ${g.length} graded ${money ? "bets you placed" : "picks"} · now ${fmt(last)}</div>`;
}
function bhSummaryCard() {
  const all = Object.values(BH.rows), mine = all.filter(bhMine), s = bhStats(mine), p = bhStats(all.filter(r => !r.slip)), h = bhHeader(LOGS["Personal: picks log"]?.description);
  return `<div class="card tap" data-open="bethistory"><span class="go">Open ›</span><div class="t">Your bets</div>
    <div class="stat"><div><b>${s.graded ? s.rec : "–"}</b><small>record</small></div><div><b>${s.graded ? fmtD(s.dollars) : "–"}</b><small>profit</small></div><div><b>${h.placedBank ? "$" + h.placedBank : "–"}</b><small>placed bankroll</small></div><div><b>${h.bankroll ? "$" + h.bankroll : "–"}</b><small>picks bankroll</small></div></div>
    <ul class="bh-list">${s.pending ? `<li>${s.pending} open bet${s.pending === 1 ? "" : "s"}</li>` : ""}<li>Placed: my picks you ticked, at your odds</li><li>Picks: every pick · ${p.rec}, ${p.graded ? fmtU(p.units) : "–"}</li></ul>
    <div class="acts"><button data-open="bethistory">See all bets</button>${bhAssets ? `<button class="g" data-open="betslip">Upload bet slip</button>` : ""}</div></div>`;
}
function bhRowHTML(r) {
  const sl = bhSlipFor(r), pl = r.status === "pending" ? "" : r.units !== null ? fmtU(r.units) : "";
  return `<div class="bh-row"><div class="bh-res ${r.status}">${r.status === "pending" ? "…" : r.status}</div>
    <div><div class="bh-bet">${r.parlay ? "🔗 Parlay: " : ""}${esc(r.bet)}${sl ? `<img class="bh-thumb" src="${esc(bhSlipUrl(sl))}" data-slip="${esc(sl.assetId)}" alt="slip">` : ""}</div>
      <div class="bh-sub">${esc([r.slip ? "from your slip" : "", r.price, r.book, r.slip ? (r.stake$ ? `$${r.stake$.toFixed(2)} stake` : "") : r.stakeU ? r.stakeU + "u" + (r.stake$ && bhMine(r) ? ` ($${r.stake$})` : "") : "", r.conf].filter(Boolean).join(" · "))}${BH.view === "picks" && bhPlacedLabel(r) ? " · " + bhPlacedLabel(r) : ""}${r.clv === true ? ' · <span class="pill good">beat close</span>' : r.clv === false ? ' · <span class="pill bad">missed close</span>' : ""}</div>
      ${r.result && r.status !== "pending" && !r.slip ? `<div class="bh-sub">${esc(r.result.replace(/\s*[+-]\d+(\.\d+)?u.*$/, ""))}</div>` : ""}
      ${BH.view === "picks" && !r.slip ? bhPlaceBox(r) : ""}</div>
    <div class="bh-pl ${r.units > 0 ? "up" : r.units < 0 ? "dn" : ""}">${BH.view === "mine" && r.dollars !== null && r.status !== "pending" ? fmtD(r.dollars) + (pl ? `<small>${pl}</small>` : "") : pl + (r.dollars !== null && r.status !== "pending" && bhMine(r) ? `<small>${fmtD(r.dollars)}</small>` : r.status === "pending" ? `<small>${esc(r.start || "pending")}</small>` : "")}</div></div>`;
}
function bhBreak(rows, key, label) {
  const by = {}; for (const r of rows.filter(r => r.status !== "pending")) (by[r[key] || "–"] ||= []).push(r);
  const ks = Object.keys(by); if (ks.length < 2) return "";
  return `<div class="card"><div class="when">${label}</div><table class="bh-tbl">${ks.map(k => { const s = bhStats(by[k]); return `<tr><td>${esc(k)}</td><td>${s.rec}</td><td>${fmtU(s.units)}</td><td>${s.roi === null ? "" : Math.round(s.roi) + "%"}</td></tr>`; }).join("")}</table></div>`;
}
async function openBetHistory() {
  const f = openFull(`<h2 style="margin-top:4px"><span>Bet history</span></h2><div id="bhBody"><div class="empty">Loading…</div></div>`);
  await bhLoad().catch(() => {});
  const draw = () => {
    const every = Object.values(BH.rows).sort((a, b) => b.date.localeCompare(a.date) || (a.parlay - b.parlay));
    const mine = BH.view === "mine", all = every.filter(r => mine ? bhMine(r) : !r.slip);
    const sports = [...new Set(all.map(r => r.sport))].filter(s => s !== "Parlay");
    const rows = all.filter(r => (BH.filter === "all" || (BH.filter === "singles" ? !r.parlay : BH.filter === "parlays" ? r.parlay : r.status === "pending")) && (BH.sport === "all" || r.sport === BH.sport));
    const s = bhStats(rows), h = bhHeader(LOGS["Personal: picks log"]?.description), notPlaced = every.filter(r => !r.slip && r.placed === "no" && r.status !== "pending").length;
    const days = {}; for (const r of rows) (days[r.date] ||= []).push(r);
    const dayName = (d) => new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    f.querySelector("#bhBody").innerHTML = `
      <div class="bh-chips" id="bhV">${[["mine", "Your bets"], ["picks", "All picks"]].map(([k, l]) => `<button data-v="${k}" class="${BH.view === k ? "on" : ""}">${l}</button>`).join("")}</div>
      ${mine ? `<div class="card"><div class="stat"><div><b>${s.graded ? s.rec : "–"}</b><small>W-L</small></div><div><b>${s.graded ? fmtD(s.dollars) : "–"}</b><small>profit</small></div><div><b>${s.roi$ === null ? "–" : Math.round(s.roi$) + "%"}</b><small>ROI</small></div><div><b>${h.bankroll ? "$" + h.bankroll : "–"}</b><small>bankroll</small></div></div>
        <ul class="bh-list"><li>Only picks you placed, plus your slips</li>${h.unit ? `<li>1 unit = $${h.unit}</li>` : ""}${notPlaced ? `<li>${notPlaced} graded pick${notPlaced === 1 ? "" : "s"} not placed, not counted</li>` : ""}</ul>${bhChart(rows, true)}</div>`
      : `<div class="card"><div class="stat"><div><b>${s.rec}</b><small>W-L</small></div><div><b>${s.graded ? fmtU(s.units) : "–"}</b><small>units</small></div><div><b>${s.roi === null ? "–" : Math.round(s.roi) + "%"}</b><small>ROI</small></div><div><b>${s.clv}</b><small>CLV</small></div></div>
        <ul class="bh-list"><li>Every pick, placed or not, in units</li><li>How good the picks are, not your money</li></ul>${bhChart(rows)}</div>`}
      <div class="bh-chips" id="bhF">${[["all", "All"], ["singles", "Singles"], ["parlays", "Parlays"], ["pending", "Open"]].map(([k, l]) => `<button data-f="${k}" class="${BH.filter === k ? "on" : ""}">${l}</button>`).join("")}</div>
      ${sports.length > 1 ? `<div class="bh-chips" id="bhS">${["all", ...sports].map(k => `<button data-s="${esc(k)}" class="${BH.sport === k ? "on" : ""}">${k === "all" ? "Every sport" : esc(k)}</button>`).join("")}</div>` : ""}
      ${bhAssets ? `<div class="acts" style="margin:4px 0 2px"><button id="bhUp">Upload bet slip</button></div>` : `<div class="empty">Slip uploads work in the Claude app.</div>`}
      ${Object.keys(days).length ? Object.entries(days).map(([d, rs]) => `<div class="bh-day">${dayName(d)}</div><div class="card" style="padding:4px 14px">${rs.map(bhRowHTML).join("")}</div>`).join("") : `<div class="empty">${mine ? "No placed bets yet. Upload a bet slip so it counts." : "No bets match."}</div>`}
      ${BH.filter === "all" && BH.sport === "all" && !mine ? bhBreak(all, "sport", "By sport") + bhBreak(all.filter(r => !r.parlay), "conf", "By confidence (singles)") : ""}
      <h2><span>Bet slips</span></h2>${BH.slips.length ? `<div class="bh-slips">${BH.slips.slice().reverse().map(s => `<img src="${esc(bhSlipUrl(s))}" data-slip="${esc(s.assetId)}" alt="bet slip">`).join("")}</div>` : '<div class="empty">Upload a screenshot of a bet slip and Claude reads the bets off it.</div>'}
      <ul class="bh-list" style="margin-top:14px"><li>Keeps every bet the picks log has shown, even after it's archived</li><li>A bet counts as yours once you tick it or a slip shows it</li></ul>`;
    f.querySelectorAll("#bhV button").forEach(b => b.onclick = () => { BH.view = b.dataset.v; draw(); });
    f.querySelectorAll("#bhF button").forEach(b => b.onclick = () => { BH.filter = b.dataset.f; draw(); });
    f.querySelectorAll("#bhS button").forEach(b => b.onclick = () => { BH.sport = b.dataset.s; draw(); });
    f.querySelector("#bhUp")?.addEventListener("click", () => bhUpload(draw));
    f.querySelectorAll("[data-slip]").forEach(i => i.onclick = (e) => { e.stopPropagation(); bhViewSlip(i.dataset.slip); });
  };
  BH.redraw = () => { if (document.body.contains(f)) draw(); };
  draw();
}
function bhViewSlip(assetId) {
  const s = BH.slips.find(x => x.assetId === assetId); if (!s) return;
  const bg = document.createElement("div"); bg.className = "sheetbg";
  bg.innerHTML = `<div class="sheet bh-big"><div class="t" style="font-size:17px">Bet slip · ${esc(s.uploaded?.slice(0, 10) || "")}</div>
    ${(s.bets || []).map(b => `<div class="when">${esc([b.date, b.bet, b.odds, b.stake != null ? "$" + b.stake : "", b.status].filter(Boolean).join(" · "))}</div>`).join("")}
    <img src="${esc(bhSlipUrl(s))}" alt="bet slip"><div class="acts"><button class="g" data-x>Close</button></div></div>`;
  bg.onclick = (e) => { if (e.target === bg || e.target.closest("[data-x]")) bg.remove(); };
  document.body.append(bg);
}
const bhToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
// Phone screenshots are big (often 1080×2400 PNG, 2–4 MB); several at once could be too much for one read.
// Shrink each to a JPEG at most 2000 px tall/wide – still easily readable – before uploading and reading.
async function bhShrink(file, max = 2000) {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.88));
    return b ? new File([b], (file.name || "slip").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
const bhErr = (e) => e?.code === "rate_limited" ? "Claude is busy – try again in a minute" : e?.code === "not_granted" ? "reading images isn't allowed in this view" : e?.code === "cancelled" ? "cancelled" : (e?.message || String(e)).slice(0, 120);
// Reads one or more slip images in ONE Claude call; each bet comes back with the number of the image it's on.
async function bhRead(blobs) {
  blobs = [].concat(blobs);
  if (!sample) throw Object.assign(new Error("Claude can't read images in this view"), { code: "not_granted" });
  const lim = await sample.limits?.().catch(() => null); if (lim && !lim.images) throw Object.assign(new Error("image reading is off"), { code: "not_granted" });
  const n = blobs.length;
  const r = await sample(`${n === 1 ? "This image is a screenshot" : `These ${n} images are screenshots`} of sportsbook bet slips or bet history (usually DraftKings). Today is ${bhToday()} (America/Denver). List every bet visible${n > 1 ? " in every image; the same bet can appear in two images – list it once" : ""}.
Return ONLY JSON, no prose: {"bets":[{"image":1,"date":"YYYY-MM-DD the bet was placed or the game date if that's all that's shown (assume this season if no year)","type":"single or parlay","bet":"short plain description, e.g. 'Tulane +3 vs Tulsa' or 'Kentucky @ Tennessee Under 49.5'; for a parlay the legs joined with ' / '","odds":"American odds as shown, e.g. -118 or +571","stake":2.00,"toWin":1.69,"book":"DraftKings","status":"open, won, lost, push, void or cashed out"}]}
"image" is the 1-based number of the image the bet is in. Use null for anything you can't read. Never include account numbers, names, balances or bet IDs.`, { images: blobs, modelTier: "default", cache: false });
  const t = String(r?.text || ""); const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  return (j.bets || []).filter(b => b && b.bet).map(b => ({ ...b, image: Math.min(n, Math.max(1, parseInt(b.image) || 1)) }));
}
const bhLine = (b) => [b.date || bhToday(), b.type === "parlay" && !/parlay/i.test(b.bet) ? "Parlay: " + b.bet : b.bet, b.odds || "?", b.stake != null ? `$${(+b.stake).toFixed(2)}${b.toWin != null ? ` to win $${(+b.toWin).toFixed(2)}` : ""}` : "$?", b.book || "DraftKings", (b.status || "open").toLowerCase()].join(" | ");
function bhUnline(l) { const p = l.split(" | ").map(s => s.trim()); if (!/^\d{4}-\d{2}-\d{2}$/.test(p[0] || "") || !p[1]) return null;
  const st = (p[3] || "").match(/\$([\d.]+)(?: to win \$([\d.]+))?/) || [];
  return { date: p[0], bet: p[1].replace(/^Parlay:\s*/i, ""), type: /^parlay:/i.test(p[1]) ? "parlay" : "single", odds: p[2], stake: st[1] ? +st[1] : null, toWin: st[2] ? +st[2] : null, book: p[4] || "DraftKings", status: p[5] || "open" }; }
async function bhUpload(redraw) {
  if (!bhAssets) { toast("Slip uploads work in the Claude app."); return; }
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.style.display = "none"; document.body.append(inp);      // some phone browsers only fire "change" for inputs in the page
  inp.onchange = async () => {
    const files = [...inp.files]; inp.remove(); if (!files.length) return;
    const n = files.length, many = n > 1;
    toast(many ? `Preparing ${n} slips…` : "Preparing the slip…");
    const imgs = await Promise.all(files.map(f => bhShrink(f)));
    // 1) upload every picture (in parallel); a failed upload is reported but doesn't stop the rest
    toast(many ? `Uploading ${n} slips…` : "Uploading the slip…");
    const ups = await Promise.allSettled(imgs.map(f => bhAssets.upload(f)));
    const failedUp = ups.filter(u => u.status === "rejected").length;
    // 2) read them: all in one call (batches of 4), falling back to one image at a time if a batch fails
    toast(many ? `Claude is reading ${n} slips…` : "Claude is reading the slip…");
    let bets = [], unread = [], why = "";
    for (let b = 0; b < n; b += 4) {
      const part = imgs.slice(b, b + 4);
      try { bets.push(...(await bhRead(part)).map(x => ({ ...x, image: x.image + b }))); }
      catch (e) {
        why = bhErr(e);
        for (let k = 0; k < part.length; k++) {
          try { bets.push(...(await bhRead(part[k])).map(x => ({ ...x, image: b + k + 1 }))); }
          catch (e2) { why = bhErr(e2); unread.push(b + k + 1); }
        }
      }
    }
    // 3) one confirmation for everything
    const note = [failedUp ? `${failedUp} of ${n} picture${failedUp === 1 ? "" : "s"} didn't upload.` : "",
      unread.length ? `Couldn't read slip${unread.length === 1 ? "" : "s"} ${unread.join(", ")}${why ? " (" + why + ")" : ""} – type those bets in.` : ""].filter(Boolean).join(" ");
    const v = await confirmSheet({ heading: many ? `Bets on these ${n} slips` : "Bets on this slip",
      body: "One bet per line: date | bet | odds | $stake to win $x | book | status. Fix anything Claude misread, or clear it to keep only the pictures." + (note ? " " + note : ""),
      fields: [{ label: "Bets", type: "textarea", value: bets.map(bhLine).join("\n") }], ok: "Save" });
    const text = v === null || v === undefined || v === false ? "" : Array.isArray(v) ? v[0] : (typeof v === "object" ? Object.values(v)[0] : v);
    const parsed = String(text || "").split("\n").map(bhUnline).filter(Boolean);
    // each saved bet goes with the picture Claude found it on (for the thumbnails); anything typed in goes with the first
    const key = (b) => String(b.bet || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const imageOf = (p) => (bets.find(b => key(b) === key(p))?.image) || 1;
    ups.forEach((u, k) => { if (u.status === "fulfilled") BH.slips.push({ assetId: u.value.id, url: u.value.url, uploaded: new Date().toISOString(), bets: parsed.filter(p => imageOf(p) === k + 1) }); });
    bhLocal("slips", BH.slips); cloudSet("betslips", { items: BH.slips, at: Date.now() });
    if (parsed.length) await bhWriteLog(parsed).catch(e => toast("Saved the slips, but couldn't update the picks log: " + (e?.message || e)));
    const saved = ups.length - failedUp;
    toast(`${saved} slip${saved === 1 ? "" : "s"} saved${parsed.length ? `, ${parsed.length} bet${parsed.length === 1 ? "" : "s"} added` : ""}.`);
    redraw?.(); try { TABS.bets(); } catch {}
  };
  inp.click();
}
// Before changing the picks log, re-read it from the calendar: the page may have been open for hours and the betting
// task or the grader may have rewritten it since. Writing back an old copy would erase their updates.
async function bhLiveLog() {
  const log = LOGS["Personal: picks log"]; if (!log) return null;
  const v = await payload(mcp.callTool(CAL, "get_event", { eventId: log.id }, { cache: { staleTime: 0, gcTime: 0, refresh: true } }));
  const e = v?.event || v; if (!e || typeof e.description !== "string") throw new Error("couldn't re-read the picks log");
  log.description = e.description; return log;
}
// actual bets go into the picks log as SLIP: lines (above the PICKS-LOG marker) so the grading task uses the real price and stake
async function bhWriteLog(bets) {
  const log = await bhLiveLog(); if (!log) throw new Error("no picks log yet");
  const lines = String(log.description || "").split("\n"), have = new Set(lines.filter(l => /^SLIP:/.test(l)).map(l => l.toLowerCase().replace(/\s+/g, " ").split(" | ").slice(0, 3).join("|")));
  const add = bets.map(b => "SLIP: " + bhLine(b)).filter(l => !have.has(l.toLowerCase().replace(/\s+/g, " ").split(" | ").slice(0, 3).join("|")));
  if (!add.length) return;
  const mi = lines.findIndex(l => l.trim() === "PICKS-LOG"); const at = mi >= 0 ? mi : lines.length;
  if (!lines.some(l => /^SLIPS \(/.test(l))) add.unshift("SLIPS (actual bets from uploaded bet slips; use these prices and stakes when grading):");
  lines.splice(at, 0, ...add); const description = lines.join("\n");
  await updateEvent(log.id, { description }); log.description = description;
}
// The picks log's pipe lines are 10 columns wide, so as a table they scroll sideways. Show it as a short summary
// plus the latest two days as wrapped rows instead; everything older is in Bet history.
window.picksLogCard = (log) => { try { return bhLogCard(log); } catch { return card(log); } };
function bhLogCard(log) {
  const d = String(log?.description || ""), h = bhHeader(d), unit = parseFloat(h.unit) || 2;
  const rows = bhParseLog(d).map(r => r.slip ? { ...r, units: r.dollars !== null ? r.dollars / unit : null } : r);
  const dates = [...new Set(rows.map(r => r.date))].sort().reverse().slice(0, 2);
  const dayName = (x) => new Date(x + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const v = BH.view; BH.view = "picks";
  const body = dates.map(x => `<div class="bh-day">${dayName(x)}</div>${rows.filter(r => r.date === x).sort((a, b) => a.slip - b.slip || a.parlay - b.parlay).map(bhRowHTML).join("")}`).join("");
  BH.view = v;
  const line = (k, t) => t ? `<div class="bh-k">${k}</div><ul class="bh-list">${t.split(/\s+\|\s+/).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  return `<div class="card"><div class="stat"><div><b>${h.placedBank ? "$" + h.placedBank : "–"}</b><small>placed bankroll</small></div><div><b>${h.bankroll ? "$" + h.bankroll : "–"}</b><small>picks bankroll</small></div><div><b>${h.unit ? "$" + h.unit : "–"}</b><small>1 unit</small></div></div>
    <div class="when" style="margin-top:6px">Tick the picks you placed. Change the odds or line if yours were different.</div>
    ${line("Your bets:", h.mine)}${line("All picks:", h.picks)}${line("CLV:", h.clv)}
    ${body || '<div class="empty">No picks logged yet.</div>'}
    <div class="acts"><button data-open="bethistory">Full bet history</button></div></div>`;
}
// PLACED CHECKBOXES: tick the picks you placed; if your odds (or, for spreads and totals, your line) were different,
// edit them before saving. The log line gets "placed: yes (your line -4, your odds -110)"; the picks record keeps the
// original line and price, and the placed bankroll is graded at yours (grade.js / bankroll.js in game-price-watcher).
const bhAttrs = (r) => `data-pl-date="${esc(r.date)}" data-pl-bet="${esc(r.bet)}" data-pl-parlay="${r.parlay ? 1 : ""}" data-pl-price="${esc(r.price)}" data-pl-line="${esc(r.line || "")}" data-pl-yodds="${esc(r.yOdds || "")}" data-pl-yline="${esc(r.yLine || "")}"`;
function bhPlaceBox(r) {
  if (r.placed === "slip") return `<div class="bh-pbox"><label><input type="checkbox" checked disabled> Placed</label><span class="bh-mine">from your slip</span></div>`;
  const on = r.placed === "yes", terms = [r.yOdds ? r.yOdds : "", r.yLine ? "line " + r.yLine : ""].filter(Boolean).join(", ");
  return `<div class="bh-pbox" ${bhAttrs(r)}><label><input type="checkbox" data-pl-box ${on ? "checked" : ""}> Placed</label>${on ? `<span class="bh-mine">${terms ? "at " + esc(terms) : "at " + esc(r.price)}</span><button class="g" data-pl-edit>Edit odds${r.line ? "/line" : ""}</button>` : ""}</div>`;
}
function bhEditor(box, checking) {
  box.parentElement.querySelector(".bh-ed")?.remove();
  const d = box.dataset, line = d.plLine;
  box.insertAdjacentHTML("afterend", `<div class="bh-ed" data-checking="${checking ? 1 : ""}">
    <label>Your odds<input inputmode="decimal" data-ed-odds value="${esc(d.plYodds || d.plPrice)}"></label>
    ${line ? `<label>Your line<input inputmode="decimal" data-ed-line value="${esc(d.plYline || line)}"></label>` : ""}
    <button data-ed-save>Save</button><button class="g" data-ed-cancel>Cancel</button></div>`);
}
const bhOdds = (v) => { const n = parseFloat(String(v).replace(/[^\d.+-]/g, "")); if (!n || Math.abs(n) < 100) return null; return (n > 0 ? "+" : "") + Math.round(n); };
const bhPpu = (o) => { const n = parseFloat(o); return !n ? null : n > 0 ? n / 100 : 100 / Math.abs(n); };
// one pick line → placed (with your terms) or not placed; dollars filled in right away when the pick is already graded
// at the same line; a different line on a graded pick waits for the grader ("yours: pending")
function bhPlacedLine(l, on, odds, line) {
  const p = l.split(" | "), logged = (p[2] || "").trim().split(" ")[0], cl = bhLineOf(p[1] || "");
  l = l.replace(/,\s*yours:\s*(?:pending|(?:W|L|P|Push)\b\s*[+-]?\$?[\d.,]*)/i, "").replace(/(result:[^|]*?\d+(?:\.\d+)?u),\s*[+-]\$[\d.,]+/i, "$1").replace(/\s*\(not placed, no \$\)/i, "").replace(/\s*\(see slip\)/i, "");
  const graded = ((l.match(/result:\s*(W|L|P|Push)\b/i) || [])[1] || "").toUpperCase().slice(0, 1), st = l.match(/(\d+(?:\.\d+)?)u \(\$(\d+(?:\.\d+)?)/), stake = st ? +st[2] : null;
  const addMoney = (m) => l.replace(/(result:\s*(?:W|L|P|Push)\b[^|]*?[+-]?\d+(?:\.\d+)?u)/i, (x) => x + m);
  if (!on) {
    l = l.replace(/placed:\s*(not yet|yes|slip|no)(\s*\([^)]*\))?/i, graded ? "placed: no" : "placed: not yet");
    return graded ? addMoney(" (not placed, no $)") : l;
  }
  let yl = null;
  if (line != null && line !== "" && cl != null) {
    const n = parseFloat(String(line).replace(/[^\d.+-]/g, ""));
    if (!isNaN(n)) { const total = /\b(Over|Under)\s+\d/i.test(p[1]); const v = total ? Math.abs(n) : (/^[+-]/.test(String(line).trim()) ? n : (cl.startsWith("-") ? -Math.abs(n) : Math.abs(n)));
      if (v !== parseFloat(cl)) yl = total ? String(v) : (v > 0 ? "+" : "") + v; }
  }
  const yo = odds && bhOdds(odds) && parseFloat(bhOdds(odds)) !== parseFloat(logged) ? bhOdds(odds) : null;
  const parts = [yl ? "your line " + yl : "", yo ? "your odds " + yo : ""].filter(Boolean);
  l = l.replace(/placed:\s*(not yet|yes|slip|no)(\s*\([^)]*\))?/i, "placed: yes" + (parts.length ? ` (${parts.join(", ")})` : ""));
  if (graded && stake !== null) {
    if (yl) return addMoney(", yours: pending");
    const per = bhPpu(yo || logged), d = graded === "W" ? stake * per : graded === "L" ? -stake : 0;
    return addMoney((yo ? `, yours: ${graded} ` : ", ") + fmtD(d));
  }
  return l;
}
async function bhSetPlaced(d, on, odds, line) {
  const log = await bhLiveLog(); if (!log) throw new Error("no picks log");
  const lines = String(log.description || "").split("\n");
  const i = lines.findIndex(l => { const p = l.split(" | ").map(x => x.trim()); return p[0] === d.plDate && p[1] && p[1].replace(/^PARLAY:\s*/i, "") === d.plBet && /^PARLAY:/i.test(p[1]) === !!d.plParlay; });
  if (i < 0) throw new Error("couldn't find that pick in the log");
  lines[i] = bhPlacedLine(lines[i], on, odds, line); const description = lines.join("\n");
  await updateEvent(log.id, { description }); log.description = description;
}
const bhAfter = async (msg) => { toast(msg); await bhLoad().catch(() => {}); BH.redraw?.(); try { TABS.bets(); } catch {} };
document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.matches?.("[data-pl-box]")) {
    e.stopPropagation(); const box = t.closest(".bh-pbox");
    if (t.checked) { t.checked = false; bhEditor(box, true); return; }          // tick → confirm your odds/line first
    t.disabled = true;
    try { await bhSetPlaced(box.dataset, false); await bhAfter("Unchecked – no longer counts as placed."); } catch (x) { t.disabled = false; t.checked = true; toast("Couldn't save: " + (x?.message || x)); }
    return;
  }
  if (t.closest?.("[data-pl-edit]")) { e.preventDefault(); e.stopPropagation(); bhEditor(t.closest(".bh-pbox"), false); return; }
  if (t.closest?.("[data-ed-cancel]")) { e.preventDefault(); e.stopPropagation(); t.closest(".bh-ed").remove(); return; }
  if (t.closest?.("[data-ed-save]")) {
    e.preventDefault(); e.stopPropagation();
    const ed = t.closest(".bh-ed"), box = ed.previousElementSibling, odds = ed.querySelector("[data-ed-odds]")?.value, line = ed.querySelector("[data-ed-line]")?.value;
    if (odds && !bhOdds(odds)) { toast("Odds like -110 or +125"); return; }
    t.disabled = true; t.textContent = "Saving…";
    try { await bhSetPlaced(box.dataset, true, odds, line); await bhAfter("Marked placed – it counts in your placed bankroll."); }
    catch (x) { t.disabled = false; t.textContent = "Save"; toast("Couldn't save: " + (x?.message || x)); }
  }
}, true);
OPEN.bethistory = openBetHistory;
OPEN.betslip = () => bhUpload(() => {});
{ const rb = TABS.bets; TABS.bets = () => { rb(); const el = $("#tab-bets"); if (!el) return;
  const hs = [...el.querySelectorAll("h2")], h = hs.find(x => /lesson/i.test(x.textContent)) || hs.find(x => /Picks log/i.test(x.textContent));
  const html = `<h2><span>Bet history</span></h2><div id="bhCard">${bhSummaryCard()}</div>`;
  if (h) h.insertAdjacentHTML("beforebegin", html); else el.insertAdjacentHTML("beforeend", html);
  bhLoad().then(() => { const c = $("#bhCard"); if (c) c.innerHTML = bhSummaryCard(); }).catch(() => {}); }; }
// the calendar can finish loading before this file does: redraw the tab once so the card shows up either way
try { if (typeof LOGS !== "undefined" && LOGS && Object.keys(LOGS).length) TABS.bets(); } catch {}

// after every calendar reload: re-read the picks log into the history, and redraw the bet history if it's open
AFTER_RELOAD.push(async () => { BH.loaded = false; await bhLoad(); BH.redraw?.(); });   // re-reads saved rows + slips too
