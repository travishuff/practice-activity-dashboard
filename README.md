# Practice Activity

## ⬇️ Download the macOS installer

[**Download Practice Activity for macOS →**](https://github.com/travishuff/practice-activity-dashboard/releases/latest)

The Releases page contains the universal `.dmg` installer for both Apple Silicon
and Intel Macs.

Practice Activity is a macOS desktop dashboard for the Mark Walker Practice Log.
It reads the existing Google Sheets layout and displays a live 365-day practice
heatmap and summary.

## Install on macOS

The release artifact is a universal `.dmg` that works on Apple Silicon and Intel
Macs.

1. Open `Practice Activity.dmg`.
2. Drag **Practice Activity** into **Applications**.
3. Open the app.
4. Follow the first-run instructions to share and connect the Practice Log.

This development build is unsigned. The first time it is opened, macOS may say
it cannot verify the developer. Control-click **Practice Activity** in
Applications, choose **Open**, then choose **Open** again. Signing and
notarization can be added later without changing the app architecture.

The installed app includes its own runtime. End users do not need Node.js,
pnpm, Terminal, or this source repository.

## Connect a Practice Log

During first-run setup, the app explains how to make the Google Sheet readable:

1. Open the Mark Walker Practice Log in Google Sheets.
2. Click **Share**.
3. Under **General access**, choose **Anyone with the link**.
4. Keep the role set to **Viewer**.
5. Click **Copy link** and paste it into Practice Activity.

The app tests the URL and sheet layout before saving it.

Anyone with the link can view the sheet, including practiced items in column C.
Viewer access does not allow them to edit it. Some managed Google Workspace
accounts may prevent link sharing.

Use **Change Practice Log** in the app to connect a different sheet. Settings and
the most recent successful response are stored in the current macOS user's
Application Support directory. Cached data is associated with its exact sheet
URL so data from a previous sheet is never used for a new one.

## Development

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

The development command opens the Electron application with Vite hot reload.

Quality checks:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm package
```

## Build the macOS installer

Build a universal unsigned DMG and ZIP on a Mac:

```bash
pnpm make:mac
```

Artifacts are written under `out/make/`. DMG generation must run on macOS.

For a faster architecture-specific local build:

```bash
pnpm make
```

## Architecture

- `electron/main.ts`: application window, IPC validation, and external links
- `electron/preload.ts`: narrow, context-isolated renderer API
- `electron/practice-service.ts`: sheet validation, refresh, and fallback logic
- `electron/settings-store.ts`: local settings and per-sheet cache
- `app/setup-wizard.tsx`: first-run sharing and URL setup
- `app/activity-dashboard.tsx`: live dashboard UI
- `app/practice-sheet.ts`: Google GViz parsing and Practice Log validation
- `app/practice-metrics.ts`: 365-day statistics

The renderer is sandboxed with Node integration disabled. Google Sheets requests
run in the Electron main process, and the renderer cannot access the filesystem
or arbitrary Electron APIs.
