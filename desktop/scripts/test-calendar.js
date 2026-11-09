// Offline test of calendar.js with a fake Google API.
const assert = require("node:assert/strict");
const { Calendar, rfc } = require("../calendar");
assert.equal(rfc("2026-11-05T18:00:00"), "2026-11-05T18:00:00-07:00");
assert.equal(rfc("2026-07-05T18:00:00"), "2026-07-05T18:00:00-06:00");
let cfg = { clientId: "id", clientSecret: "sec", refreshToken: "rt" };
const calls = [];
const fake = async (url, init = {}) => {
  calls.push([init.method || "GET", String(url), init.body]);
  const J = (o, s = 200) => ({ ok: s < 300, status: s, json: async () => o, text: async () => JSON.stringify(o) });
  if (String(url).includes("oauth2.googleapis.com/token")) return J({ access_token: "at", expires_in: 3600 });
  if ((init.method || "GET") === "GET") return J({ items: [{ id: "e1", summary: "Personal: pool log", start: { dateTime: "2026-11-05T09:00:00-07:00" } }], nextPageToken: "p2" });
  return J({ id: "new" });
};
const cal = new Calendar({ get: () => ({ ...cfg }), set: (o) => { cfg = o; } }, () => {}, fake);
(async () => {
  const l = await cal.list_events({ fullText: "POOL-LOG", startTime: "2025-11-05T18:00:00", endTime: "2026-11-06T18:00:00", pageSize: 250, orderBy: "startTime" });
  assert.equal(l.events[0].id, "e1"); assert.equal(l.nextPageToken, "p2");
  const g = new URL(calls.find(c => c[1].includes("/events?"))[1]);
  assert.equal(g.searchParams.get("q"), "POOL-LOG"); assert.equal(g.searchParams.get("timeMin"), "2025-11-05T18:00:00-07:00"); assert.equal(g.searchParams.get("singleEvents"), "true");
  await cal.create_event({ summary: "Claude: personal practiced pool", description: "x", startTime: "2026-11-05T19:00:00", endTime: "2026-11-05T19:15:00", useDefaultReminders: false });
  const c = JSON.parse(calls.find(c => c[0] === "POST" && c[1].includes("/events"))[2]);
  assert.deepEqual(c.reminders, { useDefault: false, overrides: [] }); assert.equal(c.start.timeZone, "America/Denver");
  await cal.update_event({ eventId: "e1", summary: "✅ Personal: x", useDefaultReminders: false });
  const u = calls.find(c => c[0] === "PATCH"); assert.ok(u[1].includes("/events/e1")); assert.equal(JSON.parse(u[2]).summary, "✅ Personal: x");
  assert.equal(calls.filter(c => c[1].includes("token")).length, 1, "token cached");
  console.log("calendar.js: all tests passed");
})().catch(e => { console.error(e); process.exit(1); });
