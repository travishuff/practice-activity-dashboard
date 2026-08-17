# Practice Activity Dashboard

A contribution-style dashboard for Travis Huff's daily drum practice. It reads
an anyone-with-the-link Google Sheet and visualizes its 365-day practice period
as an activity grid and summary cards.

## Features

- Daily practice heatmap with selectable day totals
- Spreadsheet-backed summary metrics
- Automatic live refresh every minute
- Responsive desktop and mobile layouts
- Explicit degraded mode with a saved snapshot when live data is unavailable

## Spreadsheet contract

- Column A contains the numbered day in the 365-day period.
- Column B contains the date. A blank date means the day has not occurred yet.
- Column C contains the items practiced.
- Column E contains minutes practiced.
- Cell G6 contains the total practice hours used for reconciliation.

The API validates dates, rejects negative practice time, and requires the sum of
the daily values to match G6 before marking a response as live. If a blank date
contains practice time, the API uses the numbered day to preserve reconciliation
and exposes the source inconsistency as a live warning.

## Use with your own Google Sheet

### 1. Download the dashboard

Fork this repository, download it as a ZIP, or clone it:

```bash
git clone https://github.com/travishuff/practice-activity-dashboard.git
cd practice-activity-dashboard
pnpm install
```

You need Node.js 22.13 or newer and [pnpm](https://pnpm.io/installation).

### 2. Set up the sheet

Use the first tab of a Google Sheet and arrange each day as a numbered header
row followed by any practice entries for that day:

| A | B | C | D | E |
| --- | --- | --- | --- | --- |
| 1 | 9/7/2025 | | | |
| | | Rudiments | | 60 |
| | | Grooves | | 30 |
| 2 | 9/8/2025 | | | |
| | | | | 0 |
| 3 | | | | |

- Number the day header rows from 1 through 365 in column A.
- Put the date in column B once that day occurs. Leave future dates blank.
- Put each practiced item in column C and its minutes in column E.
- Add more detail rows when a day contains multiple practiced items.
- Put `=SUM(E:E)/60` in cell G6 so it contains total practice hours.

In Google Sheets, select **Share**, change **General access** to **Anyone with
the link**, and choose **Viewer**. Anyone with the link can then read the sheet,
including the practiced-item text in column C, so do not include private data.

### 3. Connect and personalize the dashboard

Copy the spreadsheet ID from its URL—the text between `/d/` and `/edit`—and
replace the existing ID in both of these locations:

- `BASE_FEED` in `app/api/practice/route.ts`
- The **Open source sheet** link in `app/activity-dashboard.tsx`

The feed currently reads the first sheet tab (`gid=0`). Change that value in
`BASE_FEED` if your data is on a different tab.

Replace “Travis Huff” with your name in `app/activity-dashboard.tsx` and
`app/layout.tsx`. The included `app/practice-data.ts` is sample fallback data;
live mode uses your Google Sheet, but the sample appears if that sheet cannot be
reached.

### 4. Run it

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard checks the
sheet immediately and refreshes it once per minute. Before deploying elsewhere,
run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. The included
`.openai/hosting.json` belongs to the original private deployment, so create a
new Sites project or configure your own compatible host when publishing a fork.

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

The dashboard source lives in `app/`. The Google Sheets parsing endpoint is
`app/api/practice/route.ts`.
