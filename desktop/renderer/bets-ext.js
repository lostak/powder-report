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
  .bh-place{margin-top:6px;padding:4px 10px;font-size:12px;border-radius:99px}`; document.head.append(st); })();

const BH = { rows: {}, slips: [], loaded: false, filter: "all", sport: "all", view: "mine" };
// a bet counts as yours only when the log says you placed it, or it came from one of your slips
const bhMine = (r) => r.slip || r.placed === "yes";
const bhPlacedLabel = (r) => r.slip ? "" : r.placed === "yes" ? '<span class="pill good">placed</span>' : r.placed === "slip" ? '<span class="pill good">placed (see slip)</span>' : r.placed === "no" ? '<span class="pill">not placed</span>' : r.placed === "not yet" ? '<span class="pill">no slip yet</span>' : "";
const bhKey = (r) => (r.date + "|" + r.bet).toLowerCase().replace(/[^a-z0-9|+.-]/g, "");
const bhLocal = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem("life.bh." + k) || "null"); localStorage.setItem("life.bh." + k, JSON.stringify(v)); } catch { return null; } };
let bhAssets = null;
window.claude?.use?.("assets").then(a => { bhAssets = a; }).catch(() => {});

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
    const placed = slip ? "yes" : ((find(/^placed:/i).match(/^placed:\s*(yes|slip|no|not yet)/i) || [])[1] || "").toLowerCase() || null;
    const status = /^(W|won)$/i.test(st) ? "W" : /^(L|lost)$/i.test(st) ? "L" : /^(P|push|void)$/i.test(st) ? "P" : "pending";
    const units = parseFloat((res.match(/([+-]\d+(?:\.\d+)?)u/) || [])[1]);
    const dm = (slip ? slipSt : res).match(/([+-])\$(\d+(?:\.\d+)?)/);
    const slipStake = slip ? ((p[3] || "").match(/\$(\d+(?:\.\d+)?)/) || [])[1] : null;
    const sport = (bet.match(/\((CFB|NFL|NHL|NBA|CBB|MLB|TT)\b/i) || [])[1]?.toUpperCase() || (/table tennis|setka|liga pro/i.test(bet) ? "TT" : parlay ? "Parlay" : "Other");
    rows.push({ date: m[2], slip, parlay, bet: bet.replace(/^PARLAY:\s*/i, ""), price: (p[2] || "").split(" ")[0], priceNote: (p[2] || "").replace(/^\S+\s*/, ""),
      book: p[3] || "", conf: (find(/^(Low|Medium|High)/i).match(/^(Low|Medium|High)(-\w+)?/i) || [""])[0],
      stakeU: slip ? null : parseFloat(stake) || null, stake$: slip ? parseFloat(slipStake) || null : parseFloat((stake.match(/\$(\d+(?:\.\d+)?)/) || [])[1]) || null, placed,
      status, units: isNaN(units) ? null : units, dollars: dm && (slip || placed === "yes") ? (dm[1] === "-" ? -1 : 1) * parseFloat(dm[2]) : slip && /^push/i.test(slipSt) ? 0 : null,
      clv: /beat close/i.test(close) ? true : /(missed|didn't beat|worse than|lost to) (the )?close/i.test(close) ? false : null,
      close: close.replace(/^close:\s*/i, ""), result: slip ? slipSt : res.replace(/^result:\s*/i, ""), sport, start: find(/\d{1,2}:\d{2} [AP]M/) });
  }
  return rows;
}
function bhHeader(desc) {
  const d = String(desc || ""); const g = (re) => (d.match(re) || [])[1] || "";
  return { bankroll: g(/current \$([\d.,]+)/i), unit: g(/unit \$([\d.,]+)/i), mine: g(/^YOUR BETS[^:]*:\s*(.+)$/m), picks: g(/^PICKS RECORD[^:]*:\s*(.+)$/m) || g(/SEASON TOTALS:\s*(.+)/), clv: g(/^CLV:\s*(.+)$/m) };
}
async function bhLoad() {
  if (!BH.loaded) {
    const [r, s] = await Promise.all([cloudGet("betrows"), cloudGet("betslips")]);
    BH.rows = r?.rows || bhLocal("rows") || {}; BH.slips = s?.items || bhLocal("slips") || []; BH.loaded = true;
  }
  const log = LOGS["Personal: picks log"]; let changed = false;
  const unit = parseFloat(bhHeader(log?.description).unit) || 2;
  for (const row of bhParseLog(log?.description)) {
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
    <div class="stat"><div><b>${s.graded ? s.rec : "–"}</b><small>record</small></div><div><b>${s.graded ? fmtD(s.dollars) : "–"}</b><small>profit</small></div><div><b>${h.bankroll ? "$" + h.bankroll : "–"}</b><small>bankroll</small></div></div>
    <div class="when" style="margin-top:8px">${s.pending ? s.pending + " open · " : ""}Only bets you placed count. All picks: ${p.rec}, ${p.graded ? fmtU(p.units) : "–"}</div>
    <div class="acts"><button data-open="bethistory">See all bets</button>${bhAssets ? `<button class="g" data-open="betslip">Upload bet slip</button>` : ""}</div></div>`;
}
function bhRowHTML(r) {
  const sl = bhSlipFor(r), pl = r.status === "pending" ? "" : r.units !== null ? fmtU(r.units) : "";
  return `<div class="bh-row"><div class="bh-res ${r.status}">${r.status === "pending" ? "…" : r.status}</div>
    <div><div class="bh-bet">${r.parlay ? "🔗 Parlay: " : ""}${esc(r.bet)}${sl ? `<img class="bh-thumb" src="${esc(bhSlipUrl(sl))}" data-slip="${esc(sl.assetId)}" alt="slip">` : ""}</div>
      <div class="bh-sub">${esc([r.slip ? "from your slip" : "", r.price, r.book, r.slip ? (r.stake$ ? `$${r.stake$.toFixed(2)} stake` : "") : r.stakeU ? r.stakeU + "u" + (r.stake$ && bhMine(r) ? ` ($${r.stake$})` : "") : "", r.conf].filter(Boolean).join(" · "))}${BH.view === "picks" && bhPlacedLabel(r) ? " · " + bhPlacedLabel(r) : ""}${r.clv === true ? ' · <span class="pill good">beat close</span>' : r.clv === false ? ' · <span class="pill bad">missed close</span>' : ""}</div>
      ${r.result && r.status !== "pending" && !r.slip ? `<div class="bh-sub">${esc(r.result.replace(/\s*[+-]\d+(\.\d+)?u.*$/, ""))}</div>` : ""}
      ${BH.view === "picks" && !r.slip && (r.placed === "not yet" || r.placed === "no") ? `<button class="g bh-place" data-place-date="${esc(r.date)}" data-place-bet="${esc(r.bet)}" data-place-parlay="${r.parlay ? 1 : ""}">I placed this</button>` : ""}</div>
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
        <div class="when" style="margin-top:8px">Only bets you placed: picks marked placed, plus your uploaded slips. ${h.unit ? `1u = $${h.unit}.` : ""}${notPlaced ? ` ${notPlaced} graded pick${notPlaced === 1 ? "" : "s"} you didn't place ${notPlaced === 1 ? "isn't" : "aren't"} counted.` : ""}</div>${bhChart(rows, true)}</div>`
      : `<div class="card"><div class="stat"><div><b>${s.rec}</b><small>W-L</small></div><div><b>${s.graded ? fmtU(s.units) : "–"}</b><small>units</small></div><div><b>${s.roi === null ? "–" : Math.round(s.roi) + "%"}</b><small>ROI</small></div><div><b>${s.clv}</b><small>CLV</small></div></div>
        <div class="when" style="margin-top:8px">Every pick recommended, placed or not, in units. This is how good the picks are, not your money.</div>${bhChart(rows)}</div>`}
      <div class="bh-chips" id="bhF">${[["all", "All"], ["singles", "Singles"], ["parlays", "Parlays"], ["pending", "Open"]].map(([k, l]) => `<button data-f="${k}" class="${BH.filter === k ? "on" : ""}">${l}</button>`).join("")}</div>
      ${sports.length > 1 ? `<div class="bh-chips" id="bhS">${["all", ...sports].map(k => `<button data-s="${esc(k)}" class="${BH.sport === k ? "on" : ""}">${k === "all" ? "Every sport" : esc(k)}</button>`).join("")}</div>` : ""}
      ${bhAssets ? `<div class="acts" style="margin:4px 0 2px"><button id="bhUp">Upload bet slip</button></div>` : `<div class="empty">Slip uploads work in the Claude app.</div>`}
      ${Object.keys(days).length ? Object.entries(days).map(([d, rs]) => `<div class="bh-day">${dayName(d)}</div><div class="card" style="padding:4px 14px">${rs.map(bhRowHTML).join("")}</div>`).join("") : `<div class="empty">${mine ? "No placed bets yet. Upload a bet slip so it counts." : "No bets match."}</div>`}
      ${BH.filter === "all" && BH.sport === "all" && !mine ? bhBreak(all, "sport", "By sport") + bhBreak(all.filter(r => !r.parlay), "conf", "By confidence (singles)") : ""}
      <h2><span>Bet slips</span></h2>${BH.slips.length ? `<div class="bh-slips">${BH.slips.slice().reverse().map(s => `<img src="${esc(bhSlipUrl(s))}" data-slip="${esc(s.assetId)}" alt="bet slip">`).join("")}</div>` : '<div class="empty">Upload a screenshot of a bet slip and Claude reads the bets off it.</div>'}
      <div class="when" style="margin-top:14px">History keeps every bet the picks log has shown, even after the log rolls older ones into its totals. A bet counts as yours once a slip shows it.</div>`;
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
async function bhRead(blob) {
  if (!sample) return [];
  const lim = await sample.limits?.().catch(() => null); if (lim && !lim.images) return [];
  const r = await sample(`This image is a screenshot of a sportsbook bet slip or bet history (usually DraftKings). Today is ${bhToday()} (America/Denver). List every bet visible.
Return ONLY JSON, no prose: {"bets":[{"date":"YYYY-MM-DD the bet was placed or the game date if that's all that's shown (assume this season if no year)","type":"single or parlay","bet":"short plain description, e.g. 'Tulane +3 vs Tulsa' or 'Kentucky @ Tennessee Under 49.5'; for a parlay the legs joined with ' / '","odds":"American odds as shown, e.g. -118 or +571","stake":2.00,"toWin":1.69,"book":"DraftKings","status":"open, won, lost, push, void or cashed out"}]}
Use null for anything you can't read. Never include account numbers, names, balances or bet IDs.`, { images: [blob], modelTier: "default", cache: false });
  const t = String(r?.text || ""); const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
  return (j.bets || []).filter(b => b && b.bet);
}
const bhLine = (b) => [b.date || bhToday(), b.type === "parlay" && !/parlay/i.test(b.bet) ? "Parlay: " + b.bet : b.bet, b.odds || "?", b.stake != null ? `$${(+b.stake).toFixed(2)}${b.toWin != null ? ` to win $${(+b.toWin).toFixed(2)}` : ""}` : "$?", b.book || "DraftKings", (b.status || "open").toLowerCase()].join(" | ");
function bhUnline(l) { const p = l.split(" | ").map(s => s.trim()); if (!/^\d{4}-\d{2}-\d{2}$/.test(p[0] || "") || !p[1]) return null;
  const st = (p[3] || "").match(/\$([\d.]+)(?: to win \$([\d.]+))?/) || [];
  return { date: p[0], bet: p[1].replace(/^Parlay:\s*/i, ""), type: /^parlay:/i.test(p[1]) ? "parlay" : "single", odds: p[2], stake: st[1] ? +st[1] : null, toWin: st[2] ? +st[2] : null, book: p[4] || "DraftKings", status: p[5] || "open" }; }
async function bhUpload(redraw) {
  if (!bhAssets) { toast("Slip uploads work in the Claude app."); return; }
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files]; if (!files.length) return;
    for (const file of files) {
      toast("Uploading slip…");
      let up; try { up = await bhAssets.upload(file); } catch (e) { toast("Upload failed: " + (e?.message || e)); continue; }
      let bets = []; try { toast("Claude is reading the slip…"); bets = await bhRead(file); } catch { toast("Couldn't read the slip – type the bets in."); }
      const v = await confirmSheet({ heading: "Bets on this slip", body: "One bet per line: date | bet | odds | $stake to win $x | book | status. Fix anything Claude misread, or clear it to keep only the picture.",
        fields: [{ label: "Bets", type: "textarea", value: bets.map(bhLine).join("\n") }], ok: "Save" });
      if (v === null || v === undefined || v === false) { BH.slips.push({ assetId: up.id, url: up.url, uploaded: new Date().toISOString(), bets: [] }); }
      else {
        const text = Array.isArray(v) ? v[0] : (typeof v === "object" ? Object.values(v)[0] : v);
        const parsed = String(text || "").split("\n").map(bhUnline).filter(Boolean);
        BH.slips.push({ assetId: up.id, url: up.url, uploaded: new Date().toISOString(), bets: parsed });
        if (parsed.length) await bhWriteLog(parsed).catch(e => toast("Saved the slip, but couldn't update the picks log: " + (e?.message || e)));
      }
      bhLocal("slips", BH.slips); cloudSet("betslips", { items: BH.slips, at: Date.now() });
    }
    toast("Slip saved."); redraw?.(); try { TABS.bets(); } catch {}
  };
  inp.click();
}
// actual bets go into the picks log as SLIP: lines (above the PICKS-LOG marker) so the grading task uses the real price and stake
async function bhWriteLog(bets) {
  const log = LOGS["Personal: picks log"]; if (!log) throw new Error("no picks log yet");
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
  const line = (k, t) => t ? `<div class="when" style="margin-top:4px"><b style="color:var(--ink)">${k}</b> ${esc(t)}</div>` : "";
  return `<div class="card"><div class="stat"><div><b>${h.bankroll ? "$" + h.bankroll : "–"}</b><small>bankroll</small></div><div><b>${h.unit ? "$" + h.unit : "–"}</b><small>1 unit</small></div></div>
    ${line("Your bets:", h.mine)}${line("All picks:", h.picks)}${line("CLV:", h.clv)}
    ${body || '<div class="empty">No picks logged yet.</div>'}
    <div class="acts"><button data-open="bethistory">Full bet history</button></div></div>`;
}
// "I placed this": marks a pick placed at the logged price and stake (placed: yes). A pick already graded as not placed
// gets its dollars filled in from its units and stake. The morning grading recomputes the bankroll from these lines.
async function bhMarkPlaced(date, bet, parlay) {
  const log = LOGS["Personal: picks log"]; if (!log) throw new Error("no picks log");
  const lines = String(log.description || "").split("\n");
  const i = lines.findIndex(l => { const p = l.split(" | ").map(x => x.trim()); return p[0] === date && p[1] && p[1].replace(/^PARLAY:\s*/i, "") === bet && /^PARLAY:/i.test(p[1]) === !!parlay; });
  if (i < 0) throw new Error("couldn't find that pick in the log");
  let l = lines[i].replace(/placed:\s*(not yet|no)\b/i, "placed: yes");
  const m = l.match(/result:\s*\w+[^|]*?([+-]\d+(?:\.\d+)?)u \(not placed, no \$\)/i), st = l.match(/(\d+(?:\.\d+)?)u \(\$(\d+(?:\.\d+)?)/);
  if (m && st) { const d = +m[1] * (+st[2] / +st[1]); l = l.replace(/ \(not placed, no \$\)/, `, ${d < 0 ? "-" : "+"}$${Math.abs(d).toFixed(2)}`); }
  lines[i] = l; const description = lines.join("\n");
  await updateEvent(log.id, { description }); log.description = description;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-place-date]"); if (!b) return;
  e.preventDefault(); e.stopPropagation(); b.disabled = true; b.textContent = "Saving…";
  try {
    await bhMarkPlaced(b.dataset.placeDate, b.dataset.placeBet, b.dataset.placeParlay);
    toast("Marked placed – it counts toward your bankroll now.");
    await bhLoad().catch(() => {}); BH.redraw?.(); try { TABS.bets(); } catch {}
  } catch (x) { b.disabled = false; b.textContent = "I placed this"; toast("Couldn't mark it: " + (x?.message || x)); }
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
