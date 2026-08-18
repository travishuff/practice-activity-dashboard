# Practice Activity Dashboard

This repo turns Mark Walker's Practice Log spreadsheet, used in Google Sheets,
into a live 365-day practice dashboard. It reads the existing Practice Log
layout, so you do not need to redesign the sheet or add a summary formula.

## Features

- Daily practice heatmap with practiced items in each day's details
- Total time, daily averages, streaks, practice days, and days off
- Automatic live refresh every minute
- Responsive desktop and mobile layouts
- Saved fallback data when the live sheet is temporarily unavailable

## Use with your own Google Sheet

Start with a copy of Mark Walker's Practice Log in Google Sheets. The dashboard
uses its existing columns:

- Column A: numbered day in the 365-day period
- Column B: date; a blank date means the day has not occurred yet
- Column C: items practiced
- Column E: minutes practiced

Total practice time is calculated from column E; no separate summary cell is
required.

### Easiest setup on macOS

1. Download this repo as a ZIP and unzip it.
2. Double-click `START-HERE.command`. If macOS blocks it the first time,
   Control-click the file, choose **Open**, then choose **Open** again.
3. Follow the prompts in Terminal.

The setup will explain how to share the sheet as read-only, ask for its Google
Sheets URL, install the project dependencies, start the local server, and open
the dashboard in your browser. You need Node.js 22.13 or newer; download it from
[nodejs.org](https://nodejs.org/) if the setup asks you to.

### Manual setup

Clone or download the repo, then copy `.env.example` to `.env.local`. Paste the
full Google Sheets sharing URL into `GOOGLE_SHEET_URL`:

```dotenv
GOOGLE_SHEET_URL="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit#gid=0"
```

In Google Sheets, select **Share**, set **General access** to **Anyone with the
link**, and set the role to **Viewer**. This is read-only access, but anyone with
the link can view the sheet's contents, including column C.

Then run:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard reads the
sheet immediately and refreshes it once per minute.

## Development

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

The dashboard source lives in `app/`. The Google Sheets endpoint is
`app/api/practice/route.ts`. The included `.openai/hosting.json` belongs to the
original deployment, so configure your own host when publishing a fork.
