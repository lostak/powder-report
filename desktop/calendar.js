// Google sign-in (desktop loopback + PKCE) and the Calendar calls the My Life page makes.
// Free: Google Calendar API, no billing account needed.
const http = require("node:http");
const crypto = require("node:crypto");

const TZ = "America/Denver";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// "2026-11-05T18:00:00" (Denver wall time) -> "2026-11-05T18:00:00-07:00"
function denverOffset(d) {
  const s = d.toLocaleString("en-US", { timeZone: TZ, timeZoneName: "longOffset" });
  const m = s.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] || "00"}` : "-07:00";
}
function rfc(local) {
  if (!local) return undefined;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(local)) return local;
  return local + denverOffset(new Date(local + "Z"));
}
const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

class Calendar {
  /** store: { get(), set(obj) } for {clientId, clientSecret, refreshToken} ; openUrl(url) opens the browser */
  constructor(store, openUrl, fetchImpl = fetch) { this.store = store; this.openUrl = openUrl; this.fetch = fetchImpl; this.access = null; this.exp = 0; }

  get configured() { const c = this.store.get(); return !!(c.clientId && c.clientSecret); }
  get signedIn() { return !!this.store.get().refreshToken; }

  async signIn() {
    const { clientId, clientSecret } = this.store.get();
    if (!clientId || !clientSecret) throw new Error("Add your Google OAuth client ID and secret first.");
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const state = b64url(crypto.randomBytes(16));
    const { code, redirect } = await new Promise((resolve, reject) => {
      const srv = http.createServer((req, res) => {
        const u = new URL(req.url, "http://127.0.0.1");
        if (u.pathname !== "/cb") { res.writeHead(404); return res.end(); }
        const ok = u.searchParams.get("state") === state && u.searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<body style="font-family:sans-serif;background:#0b1220;color:#e8eef9;padding:40px">${ok ? "Signed in. You can close this tab and go back to My Life." : "Sign-in failed. Close this tab and try again."}</body>`);
        srv.close();
        ok ? resolve({ code: u.searchParams.get("code"), redirect }) : reject(new Error(u.searchParams.get("error") || "Sign-in failed"));
      });
      let redirect;
      srv.listen(0, "127.0.0.1", () => {
        redirect = `http://127.0.0.1:${srv.address().port}/cb`;
        const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", code_challenge: challenge, code_challenge_method: "S256", state });
        this.openUrl("https://accounts.google.com/o/oauth2/v2/auth?" + q);
      });
      setTimeout(() => { srv.close(); reject(new Error("Sign-in timed out")); }, 5 * 60e3);
    });
    const tok = await this.token({ grant_type: "authorization_code", code, redirect_uri: redirect, code_verifier: verifier });
    if (!tok.refresh_token) throw new Error("Google didn't return a refresh token. Try again.");
    this.store.set({ ...this.store.get(), refreshToken: tok.refresh_token });
  }

  signOut() { const c = this.store.get(); delete c.refreshToken; this.store.set(c); this.access = null; }

  async token(params) {
    const { clientId, clientSecret } = this.store.get();
    const r = await this.fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }) });
    const j = await r.json();
    if (!r.ok) { const e = new Error(j.error_description || j.error || "token error"); e.code = j.error === "invalid_grant" ? "needs_reauth" : "upstream_error"; throw e; }
    this.access = j.access_token; this.exp = Date.now() + (j.expires_in - 60) * 1000;
    return j;
  }
  async bearer() {
    if (this.access && Date.now() < this.exp) return this.access;
    const rt = this.store.get().refreshToken;
    if (!rt) { const e = new Error("Not signed in"); e.code = "needs_reauth"; throw e; }
    await this.token({ grant_type: "refresh_token", refresh_token: rt });
    return this.access;
  }
  async req(method, url, body) {
    const r = await this.fetch(url, { method, headers: { Authorization: `Bearer ${await this.bearer()}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const txt = await r.text(); const j = txt ? JSON.parse(txt) : {};
    if (r.status === 401) { this.access = null; const e = new Error("Google sign-in expired"); e.code = "needs_reauth"; throw e; }
    if (!r.ok) { const e = new Error(j.error?.message || `Calendar error ${r.status}`); e.code = r.status >= 500 ? "server_unavailable" : "tool_error"; throw e; }
    return j;
  }

  // ---- the three tools the page uses (same inputs as the Google Calendar connector) ----
  async list_events(i = {}) {
    const q = new URLSearchParams({ singleEvents: "true", orderBy: i.orderBy === "startTime" || !i.orderBy ? "startTime" : "updated", maxResults: String(Math.min(i.pageSize || 250, 250)) });
    if (i.fullText) q.set("q", i.fullText);
    q.set("timeMin", rfc(i.startTime) || new Date().toISOString());
    if (i.endTime) q.set("timeMax", rfc(i.endTime));
    if (i.pageToken) q.set("pageToken", i.pageToken);
    const j = await this.req("GET", `${API}?${q}`);
    return { events: j.items || [], nextPageToken: j.nextPageToken };
  }
  async create_event(i) {
    const body = { summary: i.summary, description: i.description || "", start: { dateTime: i.startTime, timeZone: TZ }, end: { dateTime: i.endTime, timeZone: TZ } };
    if (i.useDefaultReminders === false || i.overrideReminders) body.reminders = { useDefault: false, overrides: i.overrideReminders || [] };
    return this.req("POST", `${API}?sendUpdates=none`, body);
  }
  async update_event(i) {
    const body = {};
    if (i.summary !== undefined) body.summary = i.summary;
    if (i.description !== undefined) body.description = i.description;
    if (i.useDefaultReminders === false || i.overrideReminders) body.reminders = { useDefault: false, overrides: i.overrideReminders || [] };
    return this.req("PATCH", `${API}/${encodeURIComponent(i.eventId)}?sendUpdates=none`, body);
  }
}

module.exports = { Calendar, rfc, TZ };
