# Practice Activity Dashboard

A contribution-style dashboard for Travis Huff's daily drum practice. It reads
an anyone-with-the-link Google Sheet and visualizes its 365-day practice period
as an activity grid and summary cards.

## Features

- Daily practice heatmap with selectable day totals
- Spreadsheet-backed summary metrics
- Add, switch, and remove Practice Log URLs by their 365-day date range
- Browser-local memory for saved Practice Logs and the active selection
- Manual refresh with clear live, warning, and degraded states
- Responsive desktop and mobile layouts
- Explicit degraded mode with a saved snapshot when live data is unavailable

## Branches and releases

This repository keeps the desktop and hosted applications on separate release
branches because they use different runtimes and deployment processes.

| Branch | Application | Release flow |
| --- | --- | --- |
| `main` | Electron desktop app | Desktop CI and version-tagged installers |
| `hosted/main` | Web dashboard | Hosted CI, followed by a manual ChatGPT Sites publish |

Start hosted-dashboard changes from `hosted/main` and target `hosted/main` in
the pull request. The **Hosted dashboard CI** workflow runs tests, typechecking,
lint, and a production build for pull requests and again after a merge. Keep
desktop changes and pull requests on `main`.

ChatGPT Sites does not currently expose a standalone CI deployment interface,
so GitHub Actions validates the merge but does not publish it. To release a
green `hosted/main` commit:

1. Update the local hosted checkout with `git pull --ff-only origin hosted/main`.
2. Open the linked project in ChatGPT or Codex.
3. Ask Sites to deploy the current `hosted/main` commit to the existing Practice
   Activity site.
4. Confirm the public deployment when prompted, then verify the production URL.

Production: [Practice Activity Dashboard](https://practice-activity-dashboard.tron1k.chatgpt.site)

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

Fork this repository, download the `hosted/main` branch as a ZIP, or clone it:

```bash
git clone --branch hosted/main https://github.com/travishuff/practice-activity-dashboard.git
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

Run the dashboard, choose **Add Practice Log**, and paste the Google Sheets URL.
After the sheet is validated, its complete 365-day range appears in the
**Practice year** selector. Added logs and the active selection are saved in
that browser. Select an added log and choose **Remove** to forget it without
changing the Google Sheet.

The built-in default sheet and its saved fallback data live in
`app/practice-sources.ts` and `app/practice-data.ts`. Replace those when making
a separately branded fork. Replace “Travis Huff” in `app/activity-dashboard.tsx`
and `app/layout.tsx` to change the displayed name.

### 4. Run it

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The dashboard checks the
selected sheet when it opens; use **Refresh** to check it again. Before
publishing, run `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
The included `.openai/hosting.json` belongs to the original deployment, so
create a new Sites project or configure your own compatible host when publishing
a fork.

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
