# My Life for Windows

The same My Life screens as the phone (Today, Ski with the workout timer, Sports, Golf, Pool with session counters, Life admin, and every command button), running as a Windows app.

Desktop extras:
- **Windows notifications** for new alerts (powder, ticket drops, price/fare drops, show announcements). It checks every 15 minutes, and clicking a notification opens the app.
- **System tray icon:** closing the window keeps it running in the tray. The tray menu has notifications on/off, Start with Windows, sign out, and quit.
- **Ask Claude** opens the Claude desktop app (or claude.ai) with your question filled in, so it runs on your Claude plan.

## Cost: $0
- Google Calendar API is free with no billing account.
- Electron and the installer builder are free, open-source tools.
- Ask Claude uses your existing Claude plan; there are no API keys.
- Live snow (optional) uses your Ski Outlook Worker on Cloudflare's free tier.

## Setup (once, about 10 minutes)
1. Install **Node.js LTS** from https://nodejs.org (free).
2. In Google Cloud (use the same project as the Android app if you made one), go to **APIs & Services → Credentials → Create credentials → OAuth client ID → Desktop app**. Copy the client ID and secret. The Calendar API needs to be enabled, and your Gmail needs to be a test user on the consent screen. Both are covered in the main README.
3. Open a terminal in this `desktop` folder and run:
   ```
   npm install
   npm start
   ```
4. Paste the client ID and secret, click **Save and sign in with Google**, and approve in your browser.

## Make an installer
```
npm run dist
```
This creates `dist\My Life Setup 1.0.0.exe`. Run it to get a Start menu entry and desktop shortcut. To have it open on boot, tick **Start with Windows** in the tray menu.

## Pin it to the taskbar
After installing, open **My Life** from the Start menu, then right-click its icon on the taskbar → **Pin to taskbar**. Windows doesn't let apps pin themselves, so this one step is manual. The installer also adds a desktop shortcut and a Start menu entry.

Right-click the pinned icon for shortcuts that jump straight in: **Start ski workout**, **Start pool session**, **Tonight's betting lesson**, and **Today**.

## Updates
Installed copies update themselves: every 30 minutes they check https://github.com/lostak/powder-report/releases/download/my-life-desktop, download only what changed, and install on restart. A notification offers to restart now, and the tray menu has "Restart to update". After a build, run `scripts/publish-update.sh` to push it to that feed.

## Updating the screens
The screens come from the shared web app (`../web/index.html`). After that changes, run `npm run sync-web` and then `npm run dist`.

`npm test` runs an offline test of the Google Calendar layer.
