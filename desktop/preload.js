// Gives the My Life page the same `window.claude.use("mcp")` interface it has inside Claude,
// backed by Google Calendar directly. Ask Claude opens the Claude desktop app instead.
const { contextBridge, ipcRenderer } = require("electron");

const call = async (ch, ...a) => { const r = await ipcRenderer.invoke(ch, ...a); if (r.error) throw r.error; return r.ok; };

const mcp = {
  async callTool(server, tool, input) {
    if (server === "Google Calendar") return { payload: await call("cal", tool, input) };
    if (server === "Ski Outlook" && tool === "get_weekend_outlook") return { payload: await call("ski") };
    throw { code: "server_not_connected", message: server + " isn't available in the desktop app" };
  },
  async invalidate() {},
};

contextBridge.exposeInMainWorld("claude", { use: async (name) => (name === "mcp" ? mcp : null) });
contextBridge.exposeInMainWorld("lifeDesktop", {
  openClaude: (prompt) => call("openClaude", prompt),
  getSetup: () => call("setup:get"),
  saveSetup: (v) => call("setup:save", v),
  signIn: () => call("setup:signin"),
  openSetup: () => call("setup:open"),
  onOpen: (cb) => ipcRenderer.on("open", (_e, what) => cb(what)),
});
