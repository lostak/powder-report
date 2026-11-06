# Powder report

Every 5 minutes a GitHub Actions job checks the snow at Bradley's ski mountains and posts urgent Slack alerts. No browser, no keys, public data only:

- **Forecast** – the National Weather Service grid forecast (`snowfallAmount`) for each mountain, bucketed into ski days (snow from 6 PM the evening before through 6 PM counts for that day).
  - 🚨 **POWDER ALERT** when any mountain is forecast 8"+ over the coming weekend, or 12"+ on a weekday. Re-alerts only if the forecast grows by 4"+. Held between 10 PM and 6 AM.
- **Overnight** – the nearest SNOTEL snow stake (USDA, within 15 miles) for each mountain; new snow = rise in snow depth over the last 24 hours.
  - 🚨 **POWDER DAY** when any stake shows 6"+ new snow, once per day, with a link to the resort's own snow report. Held between 10 PM and 4:30 AM.

Edit [`powder-report/mountains.json`](powder-report/mountains.json) to change passes (`ikon`, `epic`, `local`), add `extra` mountains by name, or tune thresholds. State (what has been alerted) is committed to `powder-report/state/state.json`.

Needs the repo secret `SLACK_WEBHOOK_URL` (an incoming webhook to Bradley's own Slack DM). Part of [My Life](https://github.com/lostak/my-life).

`.github/workflows/notify.yml` is a relay Claude's scheduled tasks use to post to Slack + the Discord powder channel:
`gh workflow run notify.yml -R lostak/powder-report --ref main -f text="$(cat /tmp/msg.txt)"`.
Secrets: `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`.

A full snow report (every mountain, 7 days, overnight totals) posts every morning at 6 AM, or on demand:
`gh workflow run powder-report.yml -R lostak/powder-report --ref main -f report=true` (Pocket: "personal snow report").
