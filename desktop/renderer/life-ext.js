// My Life extensions: animated workout figures, ski-days tracker (Ikon / Epic / local), settings (city, teams, mountains).
// Loaded after the main script; shares its globals (esc, LOGS, mcp, sample, confirmSheet, updateEvent, …).
(() => { const st = document.createElement("style"); st.textContent = `
  .fig{display:block;background:#0e1626;border-radius:12px}
  .fig.sm{width:64px;height:64px;flex:none}
  .fig.big{width:100%;max-width:240px;height:auto;margin:10px auto 0;border-radius:18px}
  .figwrap{position:relative;flex:none}
  .figwrap .n{position:absolute;top:-6px;left:-6px}
  .figrow{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
  .figrow div{text-align:center;font-size:11px;color:var(--mute);line-height:1.25}
  .figrow .fig{width:100%;height:auto;margin-bottom:3px}
  .ikn{font:700 46px/1 "Barlow Condensed",sans-serif;color:var(--acc)}
  .ikbars{margin-top:10px}
  .ikrow{display:grid;grid-template-columns:110px 1fr 24px;gap:8px;align-items:center;font-size:12.5px;margin:5px 0}
  .ikrow b{text-align:right}
  .ikbar{height:8px;background:var(--panel2);border-radius:99px;overflow:hidden}
  .ikbar i{display:block;height:100%;background:linear-gradient(90deg,#3d8bff,#7cc4ff);border-radius:99px;animation:ikgrow 1s ease-out}
  @keyframes ikgrow{from{width:0}}
  .ikring{animation:ikring 1.2s ease-out}
  @keyframes ikring{from{stroke-dashoffset:var(--c)}}
  .snowbar i{background:linear-gradient(90deg,#7cc4ff,#c48bff)}
  .setpick{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .setpick label{display:flex;align-items:center;gap:6px;background:var(--panel2);border-radius:99px;padding:6px 10px;font-size:13px;color:var(--ink);margin:0}
  .setpick input{width:auto;flex:none}
  .teamrow{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)}
  .teamrow:first-child{border-top:0}
  .teamdot{display:inline-block;width:10px;height:10px;border-radius:99px;margin-right:8px;vertical-align:middle}`; document.head.append(st); })();

// ---- animated exercise figures (plain JS/SVG). Side view unless noted; floor at y=90 ----
const SP = { h: [50, 17], n: [50, 26], p: [50, 52], e1: [51, 39], w1: [52, 51], e2: [49, 39], w2: [48, 51], k1: [51, 71], f1: [52, 90], k2: [49, 71], f2: [48, 90] };
const FP = { ...SP, e1: [58, 38], w1: [60, 50], e2: [42, 38], w2: [40, 50], k1: [55, 71], f1: [56, 90], k2: [45, 71], f2: [44, 90] }; // front view
const ps = (o, b = SP) => ({ ...b, ...o });
const mirror = (q) => ({ ...q, e1: q.e2, w1: q.w2, e2: q.e1, w2: q.w1, k1: q.k2, f1: q.f2, k2: q.k1, f2: q.f1 });
const shift = (q, dx, dy) => Object.fromEntries(Object.entries(q).map(([k, [x, y]]) => [k, [x + dx, y + dy]]));
const lie = { h: [16, 82], n: [24, 84], p: [50, 86] };
const FIGS = {
  "March in place": { f: [ps({ k1: [60, 60], f1: [58, 76], e1: [44, 40], w1: [40, 49], e2: [56, 38], w2: [62, 44] }), SP, ps({ k2: [60, 60], f2: [58, 76], e2: [44, 40], w2: [40, 49], e1: [56, 38], w1: [62, 44] }), SP], ms: 380 },
  "Arm circles": { front: 1, f: [ps({ e1: [66, 27], w1: [80, 25], e2: [34, 27], w2: [20, 25] }, FP), ps({ e1: [66, 24], w1: [79, 18], e2: [34, 24], w2: [21, 18] }, FP), ps({ e1: [66, 27], w1: [84, 25], e2: [34, 27], w2: [16, 25] }, FP), ps({ e1: [66, 30], w1: [79, 33], e2: [34, 30], w2: [21, 33] }, FP)], ms: 260 },
  "Good mornings": { f: [ps({ e1: [56, 22], w1: [52, 18], e2: [44, 22], w2: [48, 18] }), ps({ h: [80, 38], n: [70, 40], p: [46, 54], e1: [72, 32], w1: [74, 36], e2: [66, 32], w2: [72, 36], k1: [50, 72], k2: [48, 72] })], ms: 900 },
  "Easy squats": { f: [SP, ps({ h: [56, 30], n: [54, 38], p: [42, 62], e1: [64, 44], w1: [74, 44], e2: [62, 44], w2: [72, 44], k1: [58, 72], k2: [56, 72] })], ms: 800 },
  "Bodyweight squats": { f: [SP, ps({ h: [58, 38], n: [56, 45], p: [36, 68], e1: [66, 46], w1: [78, 44], e2: [64, 46], w2: [76, 44], k1: [58, 70], k2: [56, 70] })], ms: 900 },
  "Fast-tempo squats": { f: [SP, ps({ h: [58, 38], n: [56, 45], p: [36, 68], e1: [66, 46], w1: [78, 44], e2: [64, 46], w2: [76, 44], k1: [58, 70], k2: [56, 70] })], ms: 450 },
  "Reverse lunges, alternating": { f: [SP, ps({ h: [50, 30], n: [50, 39], p: [48, 66], k1: [64, 70], f1: [64, 90], k2: [36, 86], f2: [24, 90], e1: [52, 52], w1: [54, 62], e2: [48, 52], w2: [46, 62] }), SP,
    ps({ h: [50, 30], n: [50, 39], p: [48, 66], k2: [64, 70], f2: [64, 90], k1: [36, 86], f1: [24, 90], e1: [52, 52], w1: [54, 62], e2: [48, 52], w2: [46, 62] })], ms: 800 },
  "Glute bridges": { f: [{ ...lie, e1: [30, 88], w1: [38, 89], e2: [30, 88], w2: [38, 89], k1: [66, 68], f1: [72, 89], k2: [64, 68], f2: [70, 89] },
    { h: [16, 82], n: [24, 82], p: [48, 68], e1: [30, 88], w1: [38, 89], e2: [30, 88], w2: [38, 89], k1: [66, 62], f1: [72, 89], k2: [64, 62], f2: [70, 89] }], ms: 900 },
  "Wall sit": { prop: "wall", f: [ps({ h: [38, 34], n: [38, 42], p: [40, 66], e1: [42, 54], w1: [52, 62], e2: [40, 54], w2: [50, 62], k1: [62, 66], f1: [62, 90], k2: [60, 66], f2: [60, 90] }),
    ps({ h: [38, 35], n: [38, 43], p: [40, 66], e1: [42, 55], w1: [52, 63], e2: [40, 55], w2: [50, 63], k1: [62, 66], f1: [62, 90], k2: [60, 66], f2: [60, 90] })], ms: 1400 },
  "Split squats, rear foot on the couch": { prop: "couch", f: [ps({ h: [52, 18], n: [52, 27], p: [50, 52], k1: [60, 72], f1: [62, 90], k2: [36, 68], f2: [24, 72] }),
    ps({ h: [50, 32], n: [50, 41], p: [48, 66], e1: [52, 54], w1: [54, 64], e2: [48, 54], w2: [46, 64], k1: [66, 70], f1: [64, 90], k2: [38, 84], f2: [24, 72] })], ms: 900 },
  "Single-leg Romanian deadlifts": { f: [ps({ k2: [46, 70], f2: [44, 86] }), ps({ h: [82, 46], n: [74, 48], p: [48, 52], e1: [72, 60], w1: [72, 72], e2: [70, 60], w2: [70, 72], k1: [52, 71], f1: [52, 90], k2: [30, 52], f2: [14, 50] })], ms: 1100 },
  "Single-leg balance, eyes closed": { f: [ps({ k2: [60, 64], f2: [56, 80], e1: [62, 36], w1: [72, 36], e2: [38, 36], w2: [28, 36] }), ps({ h: [51, 17], n: [51, 26], k2: [60, 64], f2: [56, 80], e1: [62, 35], w1: [72, 34], e2: [38, 37], w2: [28, 38] }),
    ps({ h: [49, 17], n: [49, 26], k2: [60, 64], f2: [56, 80], e1: [62, 37], w1: [72, 38], e2: [38, 35], w2: [28, 34] })], ms: 700, closed: 1 },
  "Lateral lunges": { front: 1, f: [ps({ k1: [60, 71], f1: [66, 90], k2: [40, 71], f2: [34, 90] }, FP), ps({ h: [36, 34], n: [38, 42], p: [36, 66], e1: [44, 54], w1: [48, 62], e2: [32, 54], w2: [28, 62], k1: [56, 76], f1: [70, 90], k2: [26, 70], f2: [24, 90] }, FP),
    ps({ k1: [60, 71], f1: [66, 90], k2: [40, 71], f2: [34, 90] }, FP), ps({ h: [64, 34], n: [62, 42], p: [64, 66], e1: [68, 54], w1: [72, 62], e2: [56, 54], w2: [52, 62], k1: [74, 70], f1: [76, 90], k2: [44, 76], f2: [30, 90] }, FP)], ms: 800 },
  "Plank": { f: [{ h: [82, 72], n: [74, 75], p: [46, 79], e1: [72, 89], w1: [82, 89], e2: [70, 89], w2: [80, 89], k1: [30, 83], f1: [14, 88], k2: [30, 83], f2: [14, 88] },
    { h: [82, 71], n: [74, 74], p: [46, 78], e1: [72, 89], w1: [82, 89], e2: [70, 89], w2: [80, 89], k1: [30, 83], f1: [14, 88], k2: [30, 83], f2: [14, 88] }], ms: 1200 },
  "Side plank": { front: 1, f: [{ h: [80, 58], n: [72, 62], p: [46, 72], e1: [72, 89], w1: [80, 89], e2: [72, 50], w2: [72, 36], k1: [30, 80], f1: [14, 88], k2: [30, 79], f2: [14, 86] },
    { h: [80, 56], n: [72, 60], p: [46, 69], e1: [72, 89], w1: [80, 89], e2: [72, 48], w2: [72, 34], k1: [30, 79], f1: [14, 88], k2: [30, 78], f2: [14, 86] }], ms: 1200 },
  "Dead bugs": { f: [{ ...lie, e1: [26, 70], w1: [28, 58], e2: [26, 70], w2: [28, 58], k1: [52, 66], f1: [64, 66], k2: [52, 66], f2: [64, 66] },
    { ...lie, e1: [18, 76], w1: [8, 80], e2: [26, 70], w2: [28, 58], k1: [52, 66], f1: [64, 66], k2: [66, 80], f2: [80, 84] }, { ...lie, e1: [26, 70], w1: [28, 58], e2: [26, 70], w2: [28, 58], k1: [52, 66], f1: [64, 66], k2: [52, 66], f2: [64, 66] },
    { ...lie, e2: [18, 76], w2: [8, 80], e1: [26, 70], w1: [28, 58], k2: [52, 66], f2: [64, 66], k1: [66, 80], f1: [80, 84] }], ms: 800 },
  "Bird dogs": { f: [{ h: [78, 58], n: [70, 62], p: [40, 64], e1: [70, 76], w1: [70, 89], e2: [68, 76], w2: [68, 89], k1: [40, 89], f1: [22, 89], k2: [38, 89], f2: [20, 89] },
    { h: [78, 58], n: [70, 62], p: [40, 64], e1: [80, 60], w1: [92, 58], e2: [68, 76], w2: [68, 89], k1: [40, 89], f1: [22, 89], k2: [24, 64], f2: [8, 62] }], ms: 1000 },
  "Jump squats": { f: [ps({ h: [58, 38], n: [56, 45], p: [36, 68], e1: [44, 56], w1: [36, 62], e2: [42, 56], w2: [34, 62], k1: [58, 70], k2: [56, 70] }), shift(ps({ e1: [56, 14], w1: [60, 4], e2: [54, 14], w2: [58, 4], f1: [54, 90], f2: [50, 90] }), 0, -14), SP], ms: 420 },
  "Skater hops": { front: 1, f: [ps({ h: [32, 26], n: [34, 34], p: [36, 58], e1: [46, 40], w1: [54, 46], e2: [26, 40], w2: [20, 48], k1: [36, 74], f1: [36, 90], k2: [46, 76], f2: [56, 88] }, FP),
    shift(ps({ k2: [52, 66], f2: [56, 80], k1: [48, 66], f1: [46, 80] }, FP), 0, -10), ps({ h: [68, 26], n: [66, 34], p: [64, 58], e1: [74, 40], w1: [80, 48], e2: [54, 40], w2: [46, 46], k1: [54, 76], f1: [44, 88], k2: [64, 74], f2: [64, 90] }, FP), shift(ps({}, FP), 0, -10)], ms: 380 },
  "Slow skater lunges": { front: 1, f: [ps({ h: [32, 28], n: [34, 36], p: [36, 60], e1: [46, 42], w1: [54, 48], e2: [26, 42], w2: [20, 50], k1: [36, 74], f1: [36, 90], k2: [46, 78], f2: [56, 90] }, FP),
    ps({ h: [68, 28], n: [66, 36], p: [64, 60], e1: [74, 42], w1: [80, 50], e2: [54, 42], w2: [46, 48], k1: [54, 78], f1: [44, 90], k2: [64, 74], f2: [64, 90] }, FP)], ms: 1100 },
  "Lateral line hops": { front: 1, prop: "line", f: [shift(ps({ f1: [52, 90], f2: [48, 90], k1: [52, 71], k2: [48, 71] }, FP), -14, 0), shift(ps({ f1: [52, 90], f2: [48, 90], k1: [52, 71], k2: [48, 71] }, FP), 0, -10), shift(ps({ f1: [52, 90], f2: [48, 90], k1: [52, 71], k2: [48, 71] }, FP), 14, 0), shift(ps({ f1: [52, 90], f2: [48, 90], k1: [52, 71], k2: [48, 71] }, FP), 0, -10)], ms: 260 },
  "Quick lateral steps": { front: 1, prop: "line", f: [shift(ps({ p: [50, 56], k1: [56, 72], k2: [44, 72] }, FP), -14, 0), shift(ps({ p: [50, 56], k1: [58, 72], f1: [62, 90], k2: [44, 72] }, FP), 0, 0), shift(ps({ p: [50, 56], k1: [56, 72], k2: [44, 72] }, FP), 14, 0), shift(ps({ p: [50, 56], k2: [42, 72], f2: [38, 90], k1: [56, 72] }, FP), 0, 0)], ms: 300 },
  "Squat thrusts": { f: [SP, ps({ h: [66, 46], n: [62, 52], p: [42, 70], e1: [64, 72], w1: [66, 89], e2: [62, 72], w2: [64, 89], k1: [56, 72], k2: [54, 72] }),
    { h: [82, 64], n: [74, 68], p: [48, 76], e1: [70, 80], w1: [68, 89], e2: [68, 80], w2: [66, 89], k1: [32, 82], f1: [16, 88], k2: [32, 82], f2: [16, 88] }, ps({ h: [66, 46], n: [62, 52], p: [42, 70], e1: [64, 72], w1: [66, 89], e2: [62, 72], w2: [64, 89], k1: [56, 72], k2: [54, 72] })], ms: 450 },
  "Step-back burpees": { f: [SP, ps({ h: [66, 46], n: [62, 52], p: [42, 70], e1: [64, 72], w1: [66, 89], e2: [62, 72], w2: [64, 89], k1: [56, 72], k2: [54, 72] }),
    { h: [82, 64], n: [74, 68], p: [48, 76], e1: [70, 80], w1: [68, 89], e2: [68, 80], w2: [66, 89], k1: [40, 86], f1: [28, 88], k2: [32, 82], f2: [16, 88] },
    { h: [82, 64], n: [74, 68], p: [48, 76], e1: [70, 80], w1: [68, 89], e2: [68, 80], w2: [66, 89], k1: [32, 82], f1: [16, 88], k2: [32, 82], f2: [16, 88] }, ps({ h: [66, 46], n: [62, 52], p: [42, 70], e1: [64, 72], w1: [66, 89], e2: [62, 72], w2: [64, 89], k1: [56, 72], k2: [54, 72] })], ms: 600 },
  "Ski-tuck hold with small pulses": { f: [ps({ h: [66, 36], n: [60, 42], p: [40, 62], e1: [66, 52], w1: [78, 54], e2: [64, 52], w2: [76, 54], k1: [60, 68], f1: [52, 90], k2: [58, 68], f2: [50, 90] }),
    ps({ h: [66, 39], n: [60, 45], p: [40, 65], e1: [66, 55], w1: [78, 57], e2: [64, 55], w2: [76, 57], k1: [60, 70], f1: [52, 90], k2: [58, 70], f2: [50, 90] })], ms: 450 },
  "Lateral squat walks": { front: 1, f: [ps({ h: [44, 34], n: [44, 42], p: [44, 64], e1: [52, 50], w1: [56, 46], e2: [36, 50], w2: [34, 46], k1: [56, 74], f1: [58, 90], k2: [32, 74], f2: [30, 90] }, FP),
    ps({ h: [52, 34], n: [52, 42], p: [52, 64], e1: [60, 50], w1: [64, 46], e2: [44, 50], w2: [42, 46], k1: [70, 74], f1: [74, 90], k2: [40, 74], f2: [38, 90] }, FP),
    ps({ h: [60, 34], n: [60, 42], p: [60, 64], e1: [68, 50], w1: [72, 46], e2: [52, 50], w2: [50, 46], k1: [72, 74], f1: [74, 90], k2: [48, 74], f2: [46, 90] }, FP)], ms: 550, loopBack: 1 },
  "Squat to calf raise": { f: [ps({ h: [58, 38], n: [56, 45], p: [36, 68], e1: [66, 46], w1: [78, 44], e2: [64, 46], w2: [76, 44], k1: [58, 70], k2: [56, 70] }), shift(ps({ e1: [56, 30], w1: [62, 22], e2: [54, 30], w2: [60, 22] }), 0, -5)], ms: 900 },
  "Deep squat hold": { f: [ps({ h: [56, 48], n: [54, 55], p: [44, 80], e1: [58, 70], w1: [56, 62], e2: [56, 70], w2: [54, 62], k1: [62, 66], f1: [56, 90], k2: [60, 66], f2: [54, 90] }),
    ps({ h: [56, 47], n: [54, 54], p: [44, 79], e1: [58, 69], w1: [56, 61], e2: [56, 69], w2: [54, 61], k1: [63, 66], f1: [56, 90], k2: [61, 66], f2: [54, 90] })], ms: 1500 },
  "90/90 hip switches": { front: 1, f: [{ h: [50, 40], n: [50, 49], p: [50, 80], e1: [58, 62], w1: [60, 74], e2: [42, 62], w2: [40, 74], k1: [70, 82], f1: [70, 89], k2: [32, 86], f2: [30, 89] },
    { h: [50, 40], n: [50, 49], p: [50, 80], e1: [58, 62], w1: [60, 74], e2: [42, 62], w2: [40, 74], k1: [62, 66], f1: [70, 88], k2: [38, 66], f2: [30, 88] },
    { h: [50, 40], n: [50, 49], p: [50, 80], e1: [58, 62], w1: [60, 74], e2: [42, 62], w2: [40, 74], k1: [68, 86], f1: [70, 89], k2: [30, 82], f2: [30, 89] }], ms: 1100, loopBack: 1 },
  "Couch stretch for hip flexors": { prop: "couch", f: [ps({ h: [52, 34], n: [51, 43], p: [46, 68], e1: [56, 54], w1: [62, 64], e2: [54, 54], w2: [60, 64], k1: [64, 72], f1: [66, 90], k2: [32, 89], f2: [22, 70] }),
    ps({ h: [55, 34], n: [54, 43], p: [50, 69], e1: [59, 54], w1: [65, 64], e2: [57, 54], w2: [63, 64], k1: [68, 72], f1: [66, 90], k2: [32, 89], f2: [22, 70] })], ms: 1600 },
  "Ankle rocks against a wall": { prop: "wallR", f: [ps({ h: [48, 34], n: [48, 43], p: [44, 68], e1: [56, 50], w1: [66, 50], e2: [54, 50], w2: [64, 50], k1: [62, 72], f1: [66, 90], k2: [34, 89], f2: [22, 90] }),
    ps({ h: [52, 34], n: [52, 43], p: [48, 68], e1: [60, 50], w1: [70, 48], e2: [58, 50], w2: [68, 48], k1: [74, 72], f1: [66, 90], k2: [36, 89], f2: [22, 90] })], ms: 1000 },
  "Quad stretch": { f: [ps({ e2: [44, 44], w2: [40, 56], k2: [48, 72], f2: [40, 56], e1: [56, 34], w1: [62, 24] }), ps({ e2: [44, 44], w2: [40, 57], k2: [48, 73], f2: [40, 57], e1: [56, 33], w1: [62, 23] })], ms: 1600 },
  "Hamstring stretch": { f: [ps({ h: [70, 34], n: [64, 38], p: [46, 56], e1: [66, 52], w1: [70, 62], e2: [64, 52], w2: [68, 62], k1: [60, 74], f1: [72, 89], k2: [44, 72], f2: [42, 90] }),
    ps({ h: [72, 37], n: [66, 41], p: [46, 56], e1: [68, 55], w1: [72, 65], e2: [66, 55], w2: [70, 65], k1: [60, 74], f1: [72, 89], k2: [44, 72], f2: [42, 90] })], ms: 1600 },
  "Hip flexor lunge stretch": { f: [ps({ h: [50, 34], n: [50, 43], p: [48, 68], e1: [54, 54], w1: [60, 64], e2: [52, 54], w2: [58, 64], k1: [66, 72], f1: [66, 90], k2: [34, 89], f2: [20, 90] }),
    ps({ h: [54, 34], n: [54, 43], p: [52, 70], e1: [58, 54], w1: [64, 64], e2: [56, 54], w2: [62, 64], k1: [70, 72], f1: [66, 90], k2: [36, 89], f2: [20, 90] })], ms: 1600 },
  "Child's pose": { f: [{ h: [70, 84], n: [62, 82], p: [36, 78], e1: [74, 88], w1: [86, 89], e2: [72, 88], w2: [84, 89], k1: [48, 89], f1: [26, 89], k2: [46, 89], f2: [24, 89] },
    { h: [70, 85], n: [62, 83], p: [37, 80], e1: [74, 88], w1: [87, 89], e2: [72, 88], w2: [85, 89], k1: [48, 89], f1: [26, 89], k2: [46, 89], f2: [24, 89] }], ms: 1800 },
};
const lerpP = (A, B, f) => Object.fromEntries(Object.keys(A).map(k => [k, [A[k][0] + (B[k][0] - A[k][0]) * f, A[k][1] + (B[k][1] - A[k][1]) * f]]));
const ease2 = (x) => .5 - .5 * Math.cos(Math.PI * x);
function figPose(fig, t) {
  const fr = fig.loopBack ? [...fig.f, ...fig.f.slice(1, -1).reverse()] : fig.f.length === 2 ? [fig.f[0], fig.f[1]] : fig.f;
  const n = fr.length, seg = fig.ms, total = n * seg; const tt = ((t % total) + total) % total; const i = Math.min(n - 1, Math.floor(tt / seg));
  const A = fr[i], B = fr[(i + 1) % n]; return lerpP(A, B, ease2((tt - i * seg) / seg));
}
function figSVG(q, fig, dim) {
  const L = (a, b, c, w = 3.4) => `<line x1="${q[a][0]}" y1="${q[a][1]}" x2="${q[b][0]}" y2="${q[b][1]}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const far = dim ? "#3c5170" : "#4d6a95", near = dim ? "#55739c" : "#7cc4ff";
  const props = { wall: `<rect x="26" y="8" width="6" height="82" fill="#2a3a58"/>`, wallR: `<rect x="76" y="8" width="6" height="82" fill="#2a3a58"/>`,
    couch: `<rect x="6" y="70" width="26" height="20" rx="3" fill="#3a4c6e"/><rect x="6" y="60" width="8" height="30" rx="3" fill="#3a4c6e"/>`, line: `<line x1="50" y1="86" x2="50" y2="94" stroke="#ffc65c" stroke-width="1.5"/>` }[fig.prop] || "";
  const [hx, hy] = q.h;
  return `<line x1="2" y1="90.5" x2="98" y2="90.5" stroke="#25324d" stroke-width="1.2"/>${props}
    ${L("n", "e2", far)}${L("e2", "w2", far)}${L("p", "k2", far)}${L("k2", "f2", far)}
    ${L("n", "p", near, 4)}${L("p", "k1", near)}${L("k1", "f1", near)}${L("n", "e1", near)}${L("e1", "w1", near)}
    <circle cx="${hx}" cy="${hy}" r="6" fill="#0e1626" stroke="${near}" stroke-width="3"/>${fig.closed ? `<line x1="${hx - 1}" y1="${hy - 1}" x2="${hx + 4}" y2="${hy - 1}" stroke="${near}" stroke-width="1.2"/>` : ""}
    ${fig.front ? `<text x="96" y="10" font-size="6" fill="#93a3bf" text-anchor="end" font-family="Inter,sans-serif">front view</text>` : ""}`;
}
const figHTML = (name, cls = "fig", dim = false) => FIGS[name] ? `<svg class="${cls}" viewBox="0 0 100 100" data-fig="${esc(name)}" ${dim ? 'data-dim="1"' : ""}></svg>` : "";
let figRaf = 0;
function figLoop() {
  cancelAnimationFrame(figRaf);
  const t0 = performance.now();
  const tick = (now) => {
    const els = document.querySelectorAll("svg[data-fig]");
    if (!els.length) { figRaf = 0; return; }
    els.forEach(el => { const fig = FIGS[el.dataset.fig]; if (fig) el.innerHTML = figSVG(figPose(fig, now - t0), fig, !!el.dataset.dim); });
    figRaf = requestAnimationFrame(tick);
  };
  figRaf = requestAnimationFrame(tick);
}


// ---- places, teams and mountains ----
const CITIES = {
  "Denver, CO": { region: "Colorado", teams: [["Denver Broncos", "NFL", "#fb4f14"], ["Colorado Avalanche", "NHL", "#6f263d"], ["Denver Nuggets", "NBA", "#fec524"], ["Colorado Rockies", "MLB", "#33006f"],
    ["Colorado Rapids", "MLS", "#960a2c"], ["Colorado Mammoth", "NLL", "#c8102e"], ["Colorado Buffaloes", "NCAA", "#cfb87c"], ["Colorado State Rams", "NCAA", "#1e4d2b"]] },
  "Salt Lake City, UT": { region: "Utah", teams: [["Utah Jazz", "NBA", "#002b5c"], ["Utah Mammoth", "NHL", "#6cace4"], ["Real Salt Lake", "MLS", "#b30838"], ["Utah Utes", "NCAA", "#cc0000"]] },
  "Seattle, WA": { region: "Washington", teams: [["Seattle Seahawks", "NFL", "#69be28"], ["Seattle Kraken", "NHL", "#99d9d9"], ["Seattle Mariners", "MLB", "#005c5c"], ["Seattle Sounders", "MLS", "#5d9741"]] },
  "Other": { region: "Colorado", teams: [] },
};
// pass: ikon | epic | local. rule: unlimited unless noted (assumes a full pass)
const MOUNTAINS = [
  ["Winter Park", "ikon", /winter\s*park|mary\s*jane|\bwp\b/i], ["Copper", "ikon", /copper/i], ["A-Basin", "ikon", /a-?\s?basin|arapahoe/i], ["Eldora", "ikon", /eldora/i],
  ["Steamboat", "ikon", /steamboat/i], ["Aspen Snowmass", "ikon", /aspen|snowmass|highlands|buttermilk/i, 7],
  ["Vail", "epic", /\bvail\b/i], ["Beaver Creek", "epic", /beaver\s*creek/i], ["Breckenridge", "epic", /breck/i], ["Keystone", "epic", /keystone/i], ["Crested Butte", "epic", /crested\s*butte/i],
  ["Loveland", "local", /loveland/i], ["Monarch", "local", /monarch/i], ["Ski Cooper", "local", /cooper/i], ["Wolf Creek", "local", /wolf\s*creek/i], ["Sunlight", "local", /sunlight/i], ["Echo Mountain", "local", /echo/i],
];
const PASSES = [["ikon", "Ikon"], ["epic", "Epic"], ["local", "Local mountains"]];
const DEFAULT_SET = { city: "Denver, CO", teams: ["Denver Broncos", "Colorado Avalanche", "Denver Nuggets"], passes: ["ikon"] };
let SET = (() => { try { return { ...DEFAULT_SET, ...JSON.parse(localStorage.getItem("life.settings") || "{}") }; } catch { return { ...DEFAULT_SET }; } })();
let setEv = null;
const myMountains = () => MOUNTAINS.filter(m => SET.passes.includes(m[1]));
const mtnOf = (s) => MOUNTAINS.find(m => m[2].test(s || "")) || null;
function parseSettings(d) {
  const g = (k) => (String(d || "").match(new RegExp("^\\s*" + k + ":\\s*(.+)$", "m")) || [])[1]?.trim();
  const out = {}; if (g("CITY")) out.city = g("CITY");
  if (g("TEAMS")) out.teams = g("TEAMS").split(/\s*,\s*/).filter(Boolean);
  if (g("PASSES")) { const p = g("PASSES").toLowerCase(); out.passes = /all/.test(p) ? ["ikon", "epic", "local"] : ["ikon", "epic", "local"].filter(x => p.includes(x)); }
  return out;
}
async function loadSettings(refresh) {
  try {
    const ev = await listAll("life settings", localISO(addDays(-730)), localISO(addDays(2)), 2, refresh);
    setEv = ev.filter(e => /^Personal: life settings/.test(e.summary || "")).sort((a, b) => evStart(b) - evStart(a))[0] || null;
    if (setEv) { SET = { ...DEFAULT_SET, ...parseSettings(setEv.description) }; try { localStorage.setItem("life.settings", JSON.stringify(SET)); } catch {} cloudSet("settings", { ...SET, at: Date.now() }); }
  } catch {}
  if (!setEv) { const r = await cloudGet("settings"); if (r?.teams) { const { at, ...rest } = r; SET = { ...DEFAULT_SET, ...rest }; } }
}
function settingsText(s) {
  const mt = MOUNTAINS.filter(m => s.passes.includes(m[1])).map(m => m[0] + (m[3] ? ` (${m[3]} days)` : ""));
  return `Settings for Bradley's Life app and scheduled tasks. Change them in the app (Settings).\nCITY: ${s.city}\nTEAMS: ${s.teams.join(", ")}\nPASSES: ${s.passes.length === 3 ? "All" : s.passes.map(x => x[0].toUpperCase() + x.slice(1)).join(", ")}\nMOUNTAINS: ${mt.join(", ")}\nLIFE-SETTINGS`;
}
async function saveSettings(s) {
  const desc = settingsText(s);
  if (setEv) await updateEvent(setEv.id, { description: desc });
  else { const now = new Date(); await mcp.callTool(CAL, "create_event", { summary: "Personal: life settings", description: desc, startTime: localISO(now), endTime: localISO(new Date(+now + 15 * 60e3)), useDefaultReminders: false, notificationLevel: "NONE" }); await mcp.invalidate(CAL).catch(() => {}); }
  SET = s; try { localStorage.setItem("life.settings", JSON.stringify(SET)); } catch {} cloudSet("settings", { ...SET, at: Date.now() });
}
function openSettings() {
  let city = SET.city;
  const draw = () => {
    const teams = (CITIES[city] || CITIES.Other).teams, custom = SET.teams.filter(t => !teams.some(x => x[0] === t));
    return `<div class="kicker">Settings</div><div class="big">Your city, teams & mountains</div>
      <div class="card"><div class="when">City</div><select id="sCity">${Object.keys(CITIES).map(c => `<option ${c === city ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
      <div class="card"><div class="when">Teams to follow (scores, game days, tickets for 4)</div><div class="setpick" id="sTeams">${teams.map(([t, lg]) => `<label><input type="checkbox" value="${esc(t)}" ${SET.teams.includes(t) ? "checked" : ""}>${esc(t)} <span class="when">${lg}</span></label>`).join("")}
        ${custom.map(t => `<label><input type="checkbox" value="${esc(t)}" checked>${esc(t)}</label>`).join("")}</div>
        <input id="sCustom" placeholder="Add another team (e.g. Utah Jazz)" style="margin-top:8px"></div>
      <div class="card"><div class="when">Snowfall and ski days for</div><div class="setpick" id="sPass">${PASSES.map(([k, l]) => `<label><input type="checkbox" value="${k}" ${SET.passes.includes(k) ? "checked" : ""}>${l}</label>`).join("")}<label><input type="checkbox" id="sAll" ${SET.passes.length === 3 ? "checked" : ""}>All</label></div>
        <div class="desc" id="sMtns"></div>${(CITIES[city] || {}).region !== "Colorado" ? `<div class="when" style="margin-top:6px">Mountain data covers Colorado for now.</div>` : ""}</div>
      <div class="acts"><button id="sSave" style="flex:1;padding:14px">Save</button></div>
      <div class="when" style="margin:8px 4px">Saved to a silent calendar event ("Personal: life settings") so your phone, desktop and scheduled tasks all use the same choices.</div>`;
  };
  const f = openFull(draw());
  const mt = () => { const p = [...f.querySelectorAll("#sPass input[value]:checked")].map(i => i.value); f.querySelector("#sMtns").textContent = MOUNTAINS.filter(m => p.includes(m[1])).map(m => m[0]).join(" · ") || "No mountains selected"; };
  const wire = () => {
    f.querySelector("[data-close]").onclick = closeFull;
    f.querySelector("#sCity").onchange = (e) => { city = e.target.value; f.querySelector(".in").innerHTML = `<div class="top"><button class="g" data-close>‹ Back</button><span></span></div>` + draw(); wire(); };
    f.querySelector("#sAll").onchange = (e) => { f.querySelectorAll("#sPass input[value]").forEach(i => i.checked = e.target.checked); mt(); };
    f.querySelectorAll("#sPass input[value]").forEach(i => i.onchange = () => { f.querySelector("#sAll").checked = f.querySelectorAll("#sPass input[value]:checked").length === 3; mt(); });
    mt();
    f.querySelector("#sSave").onclick = async () => {
      const teams = [...f.querySelectorAll("#sTeams input:checked")].map(i => i.value); const c = f.querySelector("#sCustom").value.trim(); if (c) teams.push(...c.split(/\s*,\s*/));
      const passes = [...f.querySelectorAll("#sPass input[value]:checked")].map(i => i.value);
      const s = { city, teams: [...new Set(teams)], passes: passes.length ? passes : ["ikon"] };
      if (!(await confirmSheet({ heading: "Save settings?", body: `City: ${s.city}\nTeams: ${s.teams.join(", ") || "none"}\nMountains: ${s.passes.length === 3 ? "all" : s.passes.join(", ")}`, ok: "Save" }))) return;
      try { await saveSettings(s); toast("Saved. Your scheduled tasks will use these too."); closeFull(); refreshSki(); renderAll(); } catch (e) { toast(writeErr(e)); }
    };
  };
  wire();
}

// ---- ski days tracker (Ikon / Epic / local) ----
function skiDays() {
  const d = LOGS["Personal: ski season log"]?.description || "";
  const days = [...d.matchAll(/^\s*SKI DAY:\s*(\d{4}-\d{2}-\d{2})\s+(.+?)\s*$/gm)].map(m => ({ date: m[1], resort: (mtnOf(m[2]) || [m[2]])[0] }));
  const seen = new Set(); return days.filter(x => { const k = x.date + x.resort; if (seen.has(k)) return false; seen.add(k); return true; }).sort((a, b) => a.date.localeCompare(b.date));
}
function ikonCard() {
  const days = skiDays(), mine = myMountains(), by = {}; days.forEach(x => by[x.resort] = (by[x.resort] || 0) + 1);
  const rows = [...mine.map(m => m[0]), ...Object.keys(by).filter(r => !mine.some(m => m[0] === r))];
  const max = Math.max(1, ...Object.values(by)), last = days.at(-1), C = 2 * Math.PI * 15;
  const limited = mine.filter(m => m[3]);
  const ring = (m) => { const u = by[m[0]] || 0; return `<div style="text-align:center"><svg viewBox="0 0 40 40" width="78" height="78"><circle cx="20" cy="20" r="15" fill="none" style="stroke:var(--panel2)" stroke-width="5"/>
    <circle class="ikring" cx="20" cy="20" r="15" fill="none" stroke="${u >= m[3] ? "#ff7b7b" : "#ffc65c"}" stroke-width="5" stroke-linecap="round" transform="rotate(-90 20 20)" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.min(1, u / m[3]))}" style="--c:${C}"/>
    <text x="20" y="22.5" font-size="8.5" text-anchor="middle" style="fill:var(--ink)" font-weight="700" font-family="Inter,sans-serif">${u}/${m[3]}</text></svg><div class="when">${esc(m[0].split(" ")[0])} days</div></div>`; };
  const passNote = SET.passes.map(p => ({ ikon: "Ikon: unlimited at Winter Park, Copper, A-Basin, Eldora, Steamboat; 7 days at Aspen Snowmass.", epic: "Epic: Vail, Beaver Creek, Breckenridge, Keystone, Crested Butte.", local: "Local: Loveland, Monarch, Ski Cooper, Wolf Creek, Sunlight, Echo Mountain." }[p])).join(" ");
  return `<div class="card ikon"><div style="display:flex;align-items:center;gap:14px">
      <div style="flex:1"><div class="when">Days skied this season</div><div class="ikn">${days.length}</div><div class="when">${last ? `Last: ${esc(last.resort)}, ${new Date(last.date + "T12:00").toLocaleDateString([], { month: "short", day: "numeric" })}` : "No days logged yet"}</div></div>
      ${limited.map(ring).join("")}</div>
    <div class="ikbars">${rows.map(n => `<div class="ikrow"><span>${esc(n)}</span><div class="ikbar"><i style="width:${100 * (by[n] || 0) / max}%"></i></div><b>${by[n] || 0}</b></div>`).join("")}</div>
    <div class="acts"><button data-ikon="log">+ Log a ski day</button>${SET.passes.includes("ikon") ? `<button class="g" data-ikon="sync">Sync from Ikon screenshot</button>` : ""}${SET.passes.includes("epic") ? `<button class="g" data-ikon="sync">Sync from Epic screenshot</button>` : ""}<button class="l" data-ikon="set">Change mountains</button></div>
    <div class="when" style="margin-top:6px">${esc(passNote)}</div></div>`;
}
async function writeSkiDays(newDays) {
  const lg = LOGS["Personal: ski season log"], have = new Set(skiDays().map(x => x.date + x.resort));
  const add = newDays.filter(x => !have.has(x.date + x.resort)); if (!add.length) { toast("Those days are already logged."); return; }
  const lines = add.map(x => `SKI DAY: ${x.date} ${x.resort}`);
  try {
    if (lg) {
      let d = String(lg.description || "");
      d = /\nSKI-LOG\s*$/.test(d) ? d.replace(/\nSKI-LOG\s*$/, "\n" + lines.join("\n") + "\nSKI-LOG") : d + "\n" + lines.join("\n");
      d = /^SKI DAYS:\s*\d+/m.test(d) ? d.replace(/^SKI DAYS:\s*\d+/m, `SKI DAYS: ${skiDays().length + add.length}`) : d;
      await updateEvent(lg.id, { description: d });
    } else {
      const now = new Date();
      await mcp.callTool(CAL, "create_event", { summary: "Personal: ski season log", description: `SKI DAYS: ${add.length}\n${lines.join("\n")}\n\nSKI-LOG`, startTime: localISO(now), endTime: localISO(new Date(+now + 15 * 60e3)), useDefaultReminders: false, notificationLevel: "NONE" });
      await mcp.invalidate(CAL).catch(() => {});
    }
    toast(`Logged ${add.length} ski day${add.length > 1 ? "s" : ""}.`); reload(true);
  } catch (e) { toast(writeErr(e)); }
}
async function ikonLog() {
  const opts = myMountains().map(m => m[0]);
  const v = await confirmSheet({ heading: "Log a ski day", fields: [{ label: "Date", type: "date", value: today(), required: true }, { label: "Mountain", type: "select", options: opts.length ? opts : MOUNTAINS.map(m => m[0]) }], ok: "Log it" });
  if (v) writeSkiDays([{ date: v[0], resort: v[1] }]);
}
async function ikonSync() {
  if (!sample) return toast("Reading screenshots needs Claude. Open this in the Claude app.");
  const lim = await sample.limits?.().catch(() => null); if (lim && !lim.images) return toast("Image reading isn't available in this view.");
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.onchange = async () => {
    const files = [...inp.files].slice(0, 4); if (!files.length) return;
    toast("Reading your screenshot…");
    try {
      const out = await sample.json(`These are screenshots from a ski pass app (Ikon or Epic) showing ski days / lift scans for the 2026-27 season. Today is ${today()}. Return JSON only: {"days":[{"date":"YYYY-MM-DD","resort":"<resort name as shown>"}]} with one entry per distinct date and resort. If the year isn't shown, use the 2026-27 season (Oct–Dec = 2026, Jan–Jun = 2027). If you can't read any days, return {"days":[]}.`, { images: files, modelTier: "default" });
      const found = (out?.days || []).map(x => ({ date: String(x.date || "").slice(0, 10), resort: (mtnOf(x.resort) || [String(x.resort || "")])[0] })).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date) && x.resort);
      const have = new Set(skiDays().map(x => x.date + x.resort)); const add = found.filter(x => !have.has(x.date + x.resort));
      if (!found.length) return toast("Couldn't find ski days in that screenshot.");
      if (!add.length) return toast(`All ${found.length} days are already logged.`);
      const ok = await confirmSheet({ heading: `Add ${add.length} ski day${add.length > 1 ? "s" : ""}?`, body: add.map(x => `${x.date}  ${x.resort}`).join("\n"), ok: "Add to my season log", note: "Read from your screenshot by Claude. Check them before adding." });
      if (ok) writeSkiDays(add);
    } catch { toast("Claude couldn't read that screenshot. Try a clearer one."); }
  };
  inp.click();
}
document.addEventListener("click", (ev) => { const b = ev.target.closest("button[data-ikon]"); if (!b) return; ({ log: ikonLog, sync: ikonSync, set: openSettings })[b.dataset.ikon](); });

// ---- your teams (Sports tab) ----
function teamsCard() {
  const all = Object.values(CITIES).flatMap(c => c.teams);
  return `<h2><span>Your teams</span><button class="l" data-ikon="set">Change</button></h2><div class="card">${SET.teams.map(t => { const x = all.find(a => a[0] === t);
    return `<div class="teamrow"><div><span class="teamdot" style="background:${x?.[2] || "#7cc4ff"}"></span><b>${esc(t)}</b> <span class="when">${x?.[1] || ""}</span></div>
      <div><button class="l" data-q="${esc(`When do the ${t} play next, and what's the latest on them?`)}">Next game</button><button class="l" data-q="${esc(`What's the cheapest way to get 4 tickets together for the next ${t} home game?`)}">Tickets</button></div></div>`; }).join("") || '<div class="empty">No teams yet.</div>'}</div>`;
}

// ---- hooks into the main app ----
async function refreshSki() {
  if (!mcp) return;
  try { const r = await mcp.callTool(SKI, "get_weekend_outlook", { passes: SET.passes }, { cache: { staleTime: 15 * 60e3, gcTime: 6 * 3600e3 } }); skiLive = await payload(r); skiOk = true; }
  catch { skiOk = false; }
  try { TABS.ski(); } catch {}
}
{
  const la = loadAll; loadAll = async (r) => { await Promise.all([la(r), loadSettings(r)]); };
  const rb = TABS.bets; TABS.bets = () => { rb(); $("#tab-bets").insertAdjacentHTML("afterbegin", teamsCard()); };
  const gear = document.createElement("button"); gear.className = "g"; gear.textContent = window.lifeDesktop ? "⚙ Life" : "⚙"; gear.title = "City, teams & mountains"; gear.onclick = openSettings; $("#refresh").before(gear, " ");
  setTimeout(refreshSki, 4000);
}

// ---- golf: watched courses + tee-time requests (calendar "Personal: golf watch"; a scheduled task checks booking sites) ----
const GOLF_COURSES = ["City Park (Denver)", "Wellshire (Denver)", "Kennedy (Denver)", "Overland Park (Denver)", "Willis Case (Denver)", "Harvard Gulch (Denver, par 3)", "Evergreen (Denver Golf)",
  "Murphy Creek (Aurora)", "Saddle Rock (Aurora)", "Meadow Hills (Aurora)", "Aurora Hills (Aurora)", "Springhill (Aurora)", "Fossil Trace (Golden)", "Riverdale Dunes (Brighton)", "Riverdale Knolls (Brighton)",
  "Legacy Ridge (Westminster)", "Indian Tree (Arvada)", "Foothills (Denver)"];
let GOLF = null;
const GOLF_KEY = "life.golf";
const golfLocal = () => { try { return JSON.parse(localStorage.getItem(GOLF_KEY) || "null"); } catch { return null; } };
// durable per-person copy (claude.ai db, private to you); null on desktop/Android, where the calendar + device copy carry it
let CLOUD = null;
const cloud = (async () => { try { const [db, user] = await Promise.all([window.claude?.use?.("db"), window.claude?.use?.("user")]); if (!db || !user) return null;
  const id = await Promise.race([user.id(), new Promise(r => setTimeout(() => r(null), 8000))]); if (!id) return null; CLOUD = db.collection("data/users/" + id); return CLOUD; } catch { return null; } })();
async function cloudGet(k) { try { const c = await Promise.race([cloud, new Promise(r => setTimeout(() => r(null), 8000))]); if (!c) return null; const snap = await Promise.race([c.doc(k).get(), new Promise(r => setTimeout(() => r(null), 8000))]); const v = snap?.data ? snap.data() : snap; return v || null; } catch { return null; } }
let cloudQ = Promise.resolve();
function cloudSet(k, v) { cloudQ = cloudQ.then(async () => { try { const c = await cloud; if (c) await c.doc(k).set(v); } catch {} }); }
const golfKeep = (g) => { const v = { id: g?.id || null, description: g?.description || "", at: Date.now() }; try { localStorage.setItem(GOLF_KEY, JSON.stringify(v)); } catch {} cloudSet("golf", v); };
async function loadGolf(refresh) {
  let local = golfLocal(); const remote = await cloudGet("golf"); if (remote?.description && (!local || (remote.at || 0) > (local.at || 0))) local = remote;
  let found = null;
  try {
    const ev = await listAll("golf watch", localISO(addDays(-730)), localISO(addDays(2)), 2, refresh);
    found = ev.filter(e => /^Personal: golf watch/.test(e.summary || "")).sort((a, b) => evStart(b) - evStart(a))[0] || null;
    if (!found && local?.id) found = await payload(mcp.callTool(CAL, "get_event", { eventId: local.id })).then(v => v?.event || v).catch(() => null);
  } catch {}
  // calendar copy wins when it has data; otherwise keep the copy saved on this device
  if (found && (/COURSE:|WANT:/.test(found.description || "") || !/COURSE:|WANT:/.test(local?.description || ""))) { GOLF = found; golfKeep(found); }
  else if (local) GOLF = { ...(found || {}), id: found?.id || local.id, summary: "Personal: golf watch", description: local.description };
  else GOLF = found;
}
function golfState() {
  const d = String(GOLF?.description || ""), L = (re) => [...d.matchAll(re)];
  return {
    courses: L(/^\s*COURSE:\s*(.+?)\s*$/gm).map(m => m[1]),
    // a WANT may name its own courses ("… 4 players at Kennedy"): that day is watched at those courses only
    wants: L(/^\s*WANT:\s*(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s+(\d)\s*players?(?:\s+(?:at|only)\s+(.+?))?\s*$/gim).map(m => ({ date: m[1], from: m[2], to: m[3], n: +m[4], at: m[5] || "", raw: m[0].trim() })),
    found: L(/^\s*FOUND:\s*(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(\d{1,2}:\d{2}\s*[AP]M)(.*)$/gim).map(m => ({ date: m[1], course: m[2], time: m[3], rest: m[4].trim() })),
    checked: (d.match(/^\s*LAST CHECKED:\s*(.+)$/m) || [])[1] || "",
    season: (d.match(/^\s*SEASON:\s*(.+)$/m) || [])[1] || "", seasonNote: (d.match(/^\s*SEASON-NOTE:\s*(.+)$/m) || [])[1] || "",
  };
}
async function saveGolf(mut) {
  if (!GOLF) { const l = golfLocal(); if (l) GOLF = { id: l.id, description: l.description }; }
  const s = golfState(); mut(s);
  const body = ["Tee-time watch for the Life app. The tee-time task checks these courses for the WANT days and adds FOUND lines.",
    ...s.courses.map(c => "COURSE: " + c), ...s.wants.map(w => `WANT: ${w.date} ${w.from}-${w.to} ${w.n} player${w.n > 1 ? "s" : ""}${w.at ? " at " + w.at : ""}`),
    ...s.found.map(f => `FOUND: ${f.date} ${f.course} ${f.time}${f.rest ? " " + f.rest : ""}`), s.season ? "SEASON: " + s.season : "", s.seasonNote ? "SEASON-NOTE: " + s.seasonNote : "", s.checked ? "LAST CHECKED: " + s.checked : "", "GOLF-WATCH"].filter(Boolean).join("\n");
  GOLF = { ...(GOLF || {}), summary: "Personal: golf watch", description: body }; golfKeep(GOLF);
  if (tab === "golf") renderGolf();
  try {
    if (GOLF.id) { await updateEvent(GOLF.id, { description: body }); GOLF = { ...GOLF, description: body }; }
    else { const now = new Date(); const res = await mcp.callTool(CAL, "create_event", { summary: "Personal: golf watch", description: body, startTime: localISO(now), endTime: localISO(new Date(+now + 15 * 60e3)), useDefaultReminders: false, notificationLevel: "NONE" });
      let id = null; try { const j = res?.structuredContent || JSON.parse((res?.content || []).map(c => c.text || "").join("")); id = j?.id || j?.event?.id || null; } catch {}
      GOLF = { id, summary: "Personal: golf watch", description: body, start: { dateTime: localISO(now) } }; golfKeep(GOLF);
      await mcp.invalidate(CAL).catch(() => {}); if (!id) { await loadGolf(true); golfKeep(GOLF); } }
    if (tab === "golf") renderGolf();
    toast("Saved. Tee sheets for your days are checked every hour (daylight tee times only).");
  } catch (e) { toast("Saved on this device; calendar sync will retry. " + writeErr(e)); }
}
const hm = (s) => { const [h, m] = s.split(":").map(Number); return h + m / 60; };
const ampm = (s) => { const m = String(s).match(/(\d{1,2}):(\d{2})\s*([AP]M)/i); if (!m) return null; let h = +m[1] % 12; if (/p/i.test(m[3])) h += 12; return h + +m[2] / 60; };
function teeTimeline(w, found) {
  const x = (h) => 4 + (h - 6) / 13 * 192; // 6 AM – 7 PM
  const dots = found.filter(f => f.date === w.date).map((f, i) => { const h = ampm(f.time); return h == null ? "" : `<circle class="teedot" style="animation-delay:${i * 120}ms" cx="${x(h)}" cy="14" r="4.5" fill="#5ee0a0"/><text x="${x(h)}" y="31" font-size="7" text-anchor="middle" fill="#5ee0a0" font-family="Inter,sans-serif">${esc(f.time.replace(/\s/g, "").toLowerCase())}</text>`; }).join("");
  const ticks = [6, 9, 12, 15, 18].map(h => `<text x="${x(h)}" y="31" font-size="6.5" text-anchor="middle" style="fill:var(--mute)" font-family="Inter,sans-serif">${h > 12 ? h - 12 : h}${h >= 12 ? "p" : "a"}</text>`).join("");
  return `<svg viewBox="0 0 200 34" style="width:100%;height:auto;display:block;margin-top:6px"><rect x="4" y="11" width="192" height="6" rx="3" style="fill:var(--panel2)"/>
    <rect class="teewin" x="${x(hm(w.from))}" y="9" width="${Math.max(2, x(hm(w.to)) - x(hm(w.from)))}" height="10" rx="4" fill="#3d8bff55" stroke="#3d8bff"/>${found.some(f => f.date === w.date) ? "" : ticks}${dots}</svg>`;
}
const golfLink = (text, fallback) => { const m = String(text || "").match(/https?:\/\/[^\s<>"')]+/); return m ? m[0] : "https://www.google.com/search?q=" + encodeURIComponent(String(fallback || "").replace(/^Personal:[^–]*–\s*/, "").replace(/\s+\w{3} \w{3} \d+.*$/, "") + " tee times"); };
const GOLF_PALS = "life.golfPals";
const golfPals = () => { try { return JSON.parse(localStorage.getItem(GOLF_PALS) || "[]"); } catch { return []; } };
async function bookTeeTime({ course, date, time, n, link, fromEvent }) {
  const pals = golfPals(), want = String(n || 2);
  const r = await confirmSheet({ heading: "Add your booked tee time", fields: [
      { label: "Course", value: course || "", required: true }, { label: "Date", type: "date", value: date || today(), required: true },
      { label: "Tee time", type: "time", value: time || "08:00", required: true },
      { label: "How many did you book for (you included)?", type: "select", options: [want, ...["1", "2", "3", "4"].filter(x => x !== want)] },
      { label: "Who's playing with you? (names, commas)", ph: pals.length ? "e.g. " + pals.slice(0, 3).join(", ") : "e.g. Mike, Dan, Chris", value: "" }],
    ok: "Add to calendar", note: "Goes on your calendar with a reminder 2 hours before and shows in the morning brief. Next you can send the group a message. Claude never books or sends for you." });
  if (!r) return;
  const [c, d, tm, pl, whoRaw] = r, who = whoRaw.split(/\s*(?:,|&|\band\b)\s*/i).map(x => x.trim()).filter(Boolean);
  const start = new Date(`${d}T${tm}`), end = new Date(+start + 4.5 * 3600e3);
  const nice12 = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), day = start.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const summary = `Personal: ⛳ tee time – ${c} ${nice12}`;
  const description = [`Booked tee time: ${c}, ${day} at ${nice12} for ${pl}.`, who.length ? `WITH: ${who.join(", ")}` : "", link ? `Course page: ${link}` : "", `TEE-TIME: ${d} ${c} ${tm} ${pl} players`].filter(Boolean).join("\n");
  try {
    if (fromEvent) await updateEvent(fromEvent, { summary, description, startTime: localISO(start), endTime: localISO(end), useDefaultReminders: false, overrideReminders: [{ method: "popup", minutes: 120 }] });
    else { await mcp.callTool(CAL, "create_event", { summary, description, startTime: localISO(start), endTime: localISO(end), useDefaultReminders: false, overrideReminders: [{ method: "popup", minutes: 120 }], notificationLevel: "NONE" }); await mcp.invalidate(CAL).catch(() => {}); }
    if (who.length) try { localStorage.setItem(GOLF_PALS, JSON.stringify([...new Set([...who, ...pals])].slice(0, 20))); } catch {}
    saveGolf(s => { s.wants = s.wants.filter(w => w.date !== d); s.found = s.found.filter(f => f.date !== d); });
    const others = +pl - 1;
    const msg = `${who.length ? "Hey " + (who.length > 1 ? who.slice(0, -1).join(", ") + " and " + who.at(-1) : who[0]) + " – g" : "G"}ot us a tee time: ${c}, ${day} at ${nice12}${others > 0 ? `, ${pl} of us` : ""}. Plan to get there 30 min early. You in?`;
    teeShare(msg);
  } catch (e) { toast(writeErr(e)); }
}
function teeShare(msg) {
  const bg = document.createElement("div"); bg.className = "sheetbg";
  const enc = encodeURIComponent(msg);
  bg.innerHTML = `<div class="sheet"><div class="t" style="font-size:17px">Tee time saved ⛳ – tell the group</div>
    <label>Message (edit it if you like)</label><textarea data-i="0" style="min-height:96px">${esc(msg)}</textarea>
    <div class="acts" style="margin-top:12px;flex-wrap:wrap"><button class="ok">Copy message</button>
      <a class="l" href="sms:?&body=${enc}" style="text-decoration:none">Open Messages</a>
      <a class="l" href="https://wa.me/?text=${enc}" target="_blank" rel="noopener" style="text-decoration:none">WhatsApp ↗</a>
      <button class="g no">Done</button></div>
    <div class="note">Copy, then paste into your group text. If "Open Messages" does nothing here, use Copy. Nothing is sent for you.</div></div>`;
  document.body.append(bg);
  const ta = bg.querySelector("textarea"), close = () => bg.remove();
  ta.oninput = () => { const e2 = encodeURIComponent(ta.value); bg.querySelector('a[href^="sms:"]').href = "sms:?&body=" + e2; bg.querySelector('a[href^="https://wa.me"]').href = "https://wa.me/?text=" + e2; };
  bg.querySelector(".ok").onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast("Copied – paste it into your group text."); } catch { ta.select(); toast("Select-all is on – copy it from the box."); } };
  bg.querySelector(".no").onclick = close; bg.onclick = (e) => { if (e.target === bg) close(); };
}
function wantSheet() {
  return new Promise(res => {
    const bg = document.createElement("div"); bg.className = "sheetbg";
    const row = (d = today(), f = "07:00", t = "11:00") => `<div class="wrow" style="display:grid;grid-template-columns:1.3fr 1fr 1fr auto;gap:6px;align-items:end;margin-top:6px">
      <div><label>Day</label><input type="date" class="wd" value="${d}"></div><div><label>From</label><input type="time" class="wf" value="${f}"></div>
      <div><label>To</label><input type="time" class="wt" value="${t}"></div><button class="l wx" style="padding:6px">✕</button></div>`;
    bg.innerHTML = `<div class="sheet"><div class="t" style="font-size:17px">Tee times to watch for</div>
      <div class="note">Add as many days and time windows as you like (two windows on one day is fine).</div>
      <div class="wrows">${row()}</div>
      <div class="acts" style="margin-top:8px"><button class="l wadd">+ Another day or time</button><button class="l wsame">+ Same times, next day</button></div>
      <label>Players</label><select class="wn"><option>2</option><option>1</option><option>3</option><option>4</option></select>
      <div class="note">Every watched course is checked every hour, day and night, for these windows. Only daylight tee times count (sunrise to 2 hours before sunset). You get a notification the moment one opens.</div>
      <div class="acts" style="margin-top:14px"><button class="ok">Watch these</button><button class="g no">Cancel</button></div></div>`;
    document.body.append(bg);
    const box = bg.querySelector(".wrows"), done = (v) => { bg.remove(); res(v); };
    const last = () => [...box.querySelectorAll(".wrow")].at(-1);
    bg.querySelector(".wadd").onclick = () => { const l = last(); box.insertAdjacentHTML("beforeend", row(l?.querySelector(".wd").value || today(), "07:00", "11:00")); };
    bg.querySelector(".wsame").onclick = () => { const l = last(); const d = new Date((l?.querySelector(".wd").value || today()) + "T12:00"); d.setDate(d.getDate() + 1);
      box.insertAdjacentHTML("beforeend", row(localISO(d).slice(0, 10), l?.querySelector(".wf").value || "07:00", l?.querySelector(".wt").value || "11:00")); };
    box.onclick = (e) => { const x = e.target.closest(".wx"); if (x && box.querySelectorAll(".wrow").length > 1) x.closest(".wrow").remove(); };
    bg.querySelector(".no").onclick = () => done(null); bg.onclick = (e) => { if (e.target === bg) done(null); };
    bg.querySelector(".ok").onclick = () => {
      const n = +bg.querySelector(".wn").value, t0 = today();
      const rows = [...box.querySelectorAll(".wrow")].map(r => ({ date: r.querySelector(".wd").value, from: r.querySelector(".wf").value, to: r.querySelector(".wt").value, n }));
      if (rows.some(r => !r.date || !r.from || !r.to)) return toast("Fill in every day and time.");
      if (rows.some(r => r.date < t0)) return toast("Pick today or a later day.");
      if (rows.some(r => r.to <= r.from)) return toast("Each window's end has to be after its start.");
      done(rows);
    };
  });
}
function renderGolf() {
  const g = golfState(), t = today();
  const wants = g.wants.filter(w => w.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const opened = EV.filter(e => /^Personal: tee time open/.test(title(e)) && !isDone(e)).sort((a, b) => evStart(b) - evStart(a)).slice(0, 6);
  const dayName = (d) => new Date(d + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const booked = EV.filter(e => /^Personal: ⛳ tee time/.test(title(e)) && !isDone(e) && evStart(e) >= +new Date(t + "T00:00")).sort((a, b) => evStart(a) - evStart(b));
  const foundRows = g.found.filter(f => f.date >= t && !opened.some(e => title(e).includes(f.course) && title(e).includes(f.time.replace(/\s+/g, " "))));
  $("#tab-golf").innerHTML =
    (booked.length ? section("Booked tee times", booked.map(e => `<div class="card"><div class="t">${esc(title(e).replace(/^Personal: ⛳ tee time – /, "⛳ "))}</div>
        <div class="when">${esc(new Date(evStart(e)).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</div>
        ${(String(e.description || "").match(/^WITH:\s*(.+)$/m) || [])[1] ? `<div class="when">With ${esc(String(e.description).match(/^WITH:\s*(.+)$/m)[1])}</div>` : ""}
        <div class="acts"><button class="l" data-golf="msggroup" data-v="${esc(e.id)}">Message the group</button>${/Course page: https?:/.test(e.description || "") ? `<a class="l" href="${esc(golfLink(e.description, ""))}" target="_blank" rel="noopener">Course page ↗</a>` : ""}<button class="l" data-golf="cancelbooked" data-v="${esc(e.id)}">Cancelled</button></div></div>`).join("")) : "")
    + section("Tee times found", opened.map(e => `<div class="card"><div class="t">${esc(title(e).replace(/^Personal: tee time open – /, "⛳ "))}</div>
        <div class="desc">${fmtDesc(String(e.description || "").split("\n").slice(0, 5).join("\n"))}</div>
        <div class="acts"><a class="g" style="text-decoration:none;padding:8px 14px;border-radius:10px;background:#1f8a5b;color:#fff;font-weight:600" href="${esc(golfLink(e.description, title(e)))}" target="_blank" rel="noopener">Book it ↗</a>
        <button class="l" data-golf="booked" data-v="${esc(e.id)}">I booked it</button><button class="l" data-golf="skip" data-v="${esc(e.id)}">Skip</button></div></div>`).join("")
      + foundRows.map(f => `<div class="card"><div class="teamrow"><div><b>${esc(f.time)}</b> · ${esc(f.course)}<div class="when">${esc(dayName(f.date))}${f.rest ? " · " + esc(f.rest.replace(/https?:\/\/\S+/g, "").trim()) : ""}</div></div>
        <a class="l" href="${esc(golfLink(f.rest, f.course))}" target="_blank" rel="noopener">Book ↗</a></div>
        <div class="acts"><button class="l" data-golf="bookedfound" data-v="${esc(JSON.stringify(f))}">I booked it</button></div></div>`).join("")
      || `<div class="empty">Nothing yet. You'll get a notification when a tee time opens on a day you want. Tap it, then "Book it" to open the course's own tee sheet.</div>`,
      `<button class="l" data-golf="addbooked">+ I booked a tee time myself</button>`)
    + section("Days you want to play", wants.map(w => `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="t">${esc(dayName(w.date))}</div>
        <div class="when">${esc(w.from)}–${esc(w.to)} · ${w.n} player${w.n > 1 ? "s" : ""}${w.at ? " · only " + esc(w.at.replace(/;\s*/g, ", ")) : ""} · ${g.found.filter(f => f.date === w.date).length} found</div></div><button class="l" data-golf="rmwant" data-v="${esc(w.raw)}">Remove</button></div>
        ${teeTimeline(w, g.found)}</div>`).join(""), `<button class="l" data-golf="addwant">+ Add a day</button>`)
    + section("Courses you'd play", `<div class="card"><div class="setpick">${g.courses.map(c => `<label>⛳ ${esc(c)} <button class="l" data-golf="rmcourse" data-v="${esc(c)}" style="padding:0 2px">✕</button></label>`).join("") || '<div class="empty">Add the public courses you want watched.</div>'}</div>
        <div class="acts"><button data-golf="addcourse">+ Add a course</button></div>${g.checked ? `<div class="when" style="margin-top:6px">Last checked: ${esc(g.checked)}</div>` : ""}</div>`)
    + section("Season", `<div class="card"><div class="t">${/^open/i.test(g.season) ? "⛳ Courses open" : g.season ? "❄️ Courses closed" : "Season not checked yet"}</div>
        <div class="when">${esc(g.seasonNote || (g.season ? "" : "The watch checks once a day whether your courses are open."))}</div>
        <div class="desc">${/^open/i.test(g.season) ? "Checking tee sheets every hour, around the clock, for daylight tee times on the days you add." : "Checking once a day until a course opens. Any day you add is checked every hour from then on, for daylight tee times only. You'll get a notification when they open."}</div></div>`);
}
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button[data-golf]"); if (!b) return; const k = b.dataset.golf, v = b.dataset.v;
  if (k === "addcourse") { const g = golfState(); const left = GOLF_COURSES.filter(c => !g.courses.includes(c));
    const r = await confirmSheet({ heading: "Add a course to watch", fields: [{ label: "Pick a public course", type: "select", options: ["(type one below)", ...left] }, { label: "Or type another course", ph: "e.g. Raccoon Creek (Littleton)" }], ok: "Add" });
    const c = r && (r[1] || (r[0] !== "(type one below)" ? r[0] : "")); if (c) saveGolf(s => { if (!s.courses.includes(c)) s.courses.push(c); }); }
  if (k === "booked") { const e = REG[v] || EV.find(x => x.id === v); if (!e) return;
    const m = title(e).match(/– (.+?) (\w{3} \w{3} \d+) (\d{1,2}:\d{2} [AP]M)/); const h = m ? ampm(m[3]) : null;
    const yr = new Date().getFullYear(); let dt = m ? new Date(`${m[2]} ${yr}`) : null; if (dt && dt < addDays(-1)) dt = new Date(`${m[2]} ${yr + 1}`);
    await bookTeeTime({ course: m?.[1], date: dt && !isNaN(dt) ? localISO(dt).slice(0, 10) : today(), time: h == null ? "" : `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round(h % 1 * 60)).padStart(2, "0")}`, n: +((e.description || "").match(/(\d) (?:open )?(?:spots|players)/) || [])[1] || 2, link: golfLink(e.description, ""), fromEvent: e.id }); }
  if (k === "bookedfound") { const f = JSON.parse(v), h = ampm(f.time); await bookTeeTime({ course: f.course, date: f.date, time: h == null ? "" : `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round(h % 1 * 60)).padStart(2, "0")}`, n: +(f.rest.match(/(\d) players?/) || [])[1] || 2, link: (f.rest.match(/https?:\/\/\S+/) || [])[0] }); }
  if (k === "addbooked") await bookTeeTime({});
  if (k === "msggroup") { const e = EV.find(x => x.id === v); if (!e) return; const d = String(e.description || ""), who = ((d.match(/^WITH:\s*(.+)$/m) || [])[1] || "").split(/,\s*/).filter(Boolean);
    const t2 = new Date(evStart(e)); teeShare(`${who.length ? "Hey " + (who.length > 1 ? who.slice(0, -1).join(", ") + " and " + who.at(-1) : who[0]) + " – r" : "R"}eminder: tee time at ${title(e).replace(/^Personal: ⛳ tee time – /, "").replace(/\s+\d{1,2}:\d{2}\s*[AP]M$/i, "")}, ${t2.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })} at ${t2.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Get there 30 min early.`); }
  if (k === "skip") { const e = REG[v] || EV.find(x => x.id === v); if (e) markDone(e, "dropped"); }
  if (k === "cancelbooked") { const e = EV.find(x => x.id === v); if (e && await confirmSheet({ heading: "Tee time cancelled?", body: title(e), ok: "Mark cancelled" })) { try { await updateEvent(e.id, { summary: "✅ CANCELLED – " + e.summary, useDefaultReminders: false, overrideReminders: [] }); toast("Marked cancelled."); reload(true); } catch (er) { toast(writeErr(er)); } } }
  if (k === "rmcourse" && await confirmSheet({ heading: `Stop watching ${v}?`, ok: "Remove" })) saveGolf(s => { s.courses = s.courses.filter(c => c !== v); });
  if (k === "addwant") {
    if (!golfState().courses.length) return toast("Add a course first.");
    const rows = await wantSheet(); if (!rows?.length) return;
    saveGolf(s => { for (const w of rows) if (!s.wants.some(x => x.date === w.date && x.from === w.from && x.to === w.to)) s.wants.push(w); });
    toast(`Watching ${rows.length} time window${rows.length > 1 ? "s" : ""} – checked every hour from now on (daylight tee times only).`); }
  if (k === "rmwant" && await confirmSheet({ heading: "Stop watching this day?", body: v, ok: "Remove" })) saveGolf(s => { s.wants = s.wants.filter(w => w.raw !== v && `WANT: ${w.date} ${w.from}-${w.to} ${w.n} players` !== v); });
});
{
  const st = document.createElement("style"); st.textContent = `.teedot{animation:teepop .5s ease-out both}@keyframes teepop{from{r:0;opacity:0}}.teewin{animation:teewin .8s ease-out}@keyframes teewin{from{opacity:0}}`; document.head.append(st);
  const sec = document.createElement("section"); sec.id = "tab-golf"; sec.className = "hide"; $("#tab-pool").after(sec);
  TABS.golf = renderGolf; SUGS.golf = ["Any tee times this weekend?", "Is it golf weather Saturday?", "Cheapest round near Aurora?"];
  const btn = document.createElement("button"); btn.dataset.tab = "golf"; btn.textContent = "Golf"; document.querySelector('nav button[data-tab="life"]').before(btn);
  btn.onclick = () => { tab = "golf"; document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === btn)); Object.keys(TABS).forEach(k => $("#tab-" + k).classList.toggle("hide", k !== "golf")); renderSugs(); location.hash = "golf"; window.scrollTo(0, 0); };
  document.querySelector('nav button[data-tab="life"]').textContent = "Admin";
  document.querySelector('nav button[data-tab="bets"]').textContent = "Sports";
  const la2 = loadAll; loadAll = async (r) => { await Promise.all([la2(r), loadGolf(r)]); };
  if (location.hash === "#golf") setTimeout(() => btn.click(), 0);
}

// ---- everything you add shows up right away ----
// 1) Watches are written straight to the calendar (same format the Pocket processor uses), not queued.
async function createWatch(summary, lines, kind) {
  if (!mcp) return toast("Open this in Claude with Google Calendar connected.");
  const now = new Date(), description = [...lines, "Added from the Life app."].join("\n");
  try {
    const res = await mcp.callTool(CAL, "create_event", { summary, description, startTime: localISO(now), endTime: localISO(new Date(+now + 15 * 60e3)), useDefaultReminders: false, notificationLevel: "NONE" });
    let id = "local-" + Date.now(); try { const j = res?.structuredContent || JSON.parse((res?.content || []).map(c => c.text || "").join("")); id = j?.id || j?.event?.id || id; } catch {}
    WATCH[kind] = [{ id, summary, description, start: { dateTime: localISO(now) } }, ...WATCH[kind].filter(w => w.summary !== summary)];
    renderAll(); toast("Added. The watch checks it on its next run.");
    await mcp.invalidate(CAL).catch(() => {}); reload(true);
  } catch (e) { toast(writeErr(e)); }
}
CMDS.show = async () => { const v = await confirmSheet({ heading: "Watch for a Denver show", fields: [{ label: "Artist, comedian, team or event", required: true }, { label: "Notes (venue, dates, seats)", ph: "Red Rocks only" }], ok: "Start watching" });
  if (v) createWatch(`Show watch: ${v[0]}`, [`NAME: ${v[0]}`, `NOTES: ${v[1] || "any Denver-area show"}`, "ANNOUNCED: none", "SHOW-WATCH"], "show"); };
CMDS.price = async () => { const v = await confirmSheet({ heading: "Watch an item's price", fields: [{ label: "Item (model, size, color)", required: true, ph: "AirPods Pro 2" }, { label: "Target price (optional)", type: "number", ph: "180" }, { label: "Stores (optional)", ph: "Costco, Best Buy" }], ok: "Start watching" });
  if (v) createWatch(`Price watch: ${v[0]} – ${v[1] ? "target $" + v[1] : "any drop"}`, ["TYPE: ITEM", `ITEM: ${v[0]}`, `TARGET: ${v[1] ? "$" + v[1] : "none – alert on a notable drop"}`, `STORES: ${v[2] || "any reputable retailer"}`, "LAST ALERTED: none", "PRICE-WATCH"], "price"); };
CMDS.flight = async () => { const v = await confirmSheet({ heading: "Watch a flight from Denver", fields: [{ label: "Destination", required: true, ph: "Cabo" }, { label: "Dates or month", required: true, ph: "March, 5 nights" }, { label: "Target per person (optional)", type: "number" }, { label: "Travelers / preferences", ph: "2 people, nonstop" }], ok: "Start watching" });
  if (v) { const trav = (v[3].match(/(\d+)\s*(people|travel|adults?|of us)/i) || [])[1] || "1";
    createWatch(`Price watch: flight DEN–${v[0]} ${v[1]} – ${v[2] ? "target $" + v[2] : "any drop"}`, ["TYPE: FLIGHT", `ROUTE: DEN to ${v[0]}`, `DATES: ${v[1]}`, `TRIP: ${/one[- ]way/i.test(v[3]) ? "one-way" : "round trip"}`, `TRAVELERS: ${trav}`, `PREFERENCES: ${v[3] || "none"}`, `TARGET: ${v[2] ? "$" + v[2] + " per person" : "none – alert on a notable drop"}`, "LAST ALERTED: none", "PRICE-WATCH"], "price"); } };

// 2) Watches are also found by title, so none go missing if the marker search misses them.
{ const la3 = loadAll; loadAll = async (r) => { await la3(r);
  try { const [sw2, pw2] = await Promise.all([listAll("Show watch", localISO(addDays(-365)), localISO(addDays(1)), 1, r), listAll("Price watch", localISO(addDays(-365)), localISO(addDays(1)), 1, r)]);
    const merge = (cur, more, re) => { const ids = new Set(cur.map(x => x.id)); return [...cur, ...more.filter(e => re.test(e.summary || "") && !ids.has(e.id))]; };
    WATCH.show = merge(WATCH.show, sw2, /^(✅\s*)?Show watch:/);
    WATCH.price = merge(WATCH.price, pw2.filter(e => !/\(log\)$/.test(e.summary || "")), /^(✅\s*)?Price watch:/);
  } catch {} }; }

// 3) Anything queued for the Pocket processor shows as pending in the tab you added it from, the moment you add it.
const PEND_TAB = [[/show watch|stop show watch|betting lesson|ticket|team/i, "bets"], [/golf|tee time/i, "golf"], [/ski day|skied|ski workout|passes/i, "ski"], [/pool/i, "pool"],
  [/price watch|flight watch|stop watching|bought|oil change|home:|birthday|anniversary|expires|whostarts|done:/i, "life"]];
const pendTab = (s) => (PEND_TAB.find(([re]) => re.test(s)) || [, "today"])[1];
const pendBlock = (k) => { const mine = NOTES.filter(n => pendTab(n.summary || "") === k); if (!mine.length) return "";
  return `<div class="card" style="border-color:#e0a84a66"><div class="t">⏳ Waiting on Claude</div>${mine.map(n => `<div class="when" style="margin-top:4px">${esc(cap1(n.summary.replace(/^Claude:?\s*(personal\s*)?/i, "")))}</div>`).join("")}
    <div class="note" style="margin-top:6px">Your Pocket processor sets ${mine.length > 1 ? "these" : "this"} up at the top of the hour (8 AM–7 PM).</div></div>`; };
for (const k of Object.keys(TABS)) if (k !== "today") { const f = TABS[k]; TABS[k] = () => { f(); const el = $("#tab-" + k), b = pendBlock(k); if (el && b) el.insertAdjacentHTML("afterbegin", b); }; }
{ const q0 = queue; queue = async (cmd, detail = "") => { NOTES = [{ id: "pending-" + Date.now(), summary: `Claude: personal ${cmd}`, description: "", start: { dateTime: localISO(new Date()) } }, ...NOTES]; renderAll(); return q0(cmd, detail); }; }
