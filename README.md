# Practice Activity Dashboard

A private, contribution-style dashboard for daily drum practice. It summarizes
the linked Google Sheet and visualizes the latest 365 days as an activity grid.

## Features

- Daily practice heatmap with selectable day totals
- Spreadsheet-backed summary metrics
- Automatic refresh checks every minute
- Responsive desktop and mobile layouts
- Verified snapshot fallback when the private sheet is unavailable

## Development

Requires Node.js 22.13 or newer.

```bash
pnpm install
pnpm dev
pnpm build
```

The dashboard source lives in `app/`. The Google Sheets parsing endpoint is
`app/api/practice/route.ts`.
