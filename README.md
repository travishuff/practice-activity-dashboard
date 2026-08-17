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
