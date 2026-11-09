// Copies the shared My Life page (../web/index.html) into the desktop app.
const fs = require("node:fs"), path = require("node:path");
fs.copyFileSync(path.join(__dirname, "..", "..", "web", "index.html"), path.join(__dirname, "..", "renderer", "index.html"));
console.log("Copied web/index.html → renderer/index.html");
fs.copyFileSync(path.join(__dirname, "..", "..", "web", "life-ext.js"), path.join(__dirname, "..", "renderer", "life-ext.js"));
console.log("Copied web/life-ext.js → renderer/life-ext.js");
fs.copyFileSync(path.join(__dirname, "..", "..", "web", "bets-ext.js"), path.join(__dirname, "..", "renderer", "bets-ext.js"));
console.log("Copied web/bets-ext.js → renderer/bets-ext.js");
for (const f of ["wide.css", "wide.js", "theme.css", "theme.js"]) {
  fs.copyFileSync(path.join(__dirname, "..", "..", "web", f), path.join(__dirname, "..", "renderer", f));
  console.log(`Copied web/${f} → renderer/${f}`);
}
