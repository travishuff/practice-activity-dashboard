import { app, BrowserWindow, ipcMain, shell } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { MAX_USER_NAME_LENGTH, normalizeUserName } from "../app/user-name";
import {
  devSheetUrl,
  isDevEnvironment,
  applyDevUserDataDirectory,
} from "./dev-environment";
import {
  configurePracticeLog,
  getPracticeData,
  getSetupStatus,
} from "./practice-service";

const SHARING_HELP_URL = "https://support.google.com/drive/answer/2494822";
const INSTALLER_SMOKE_TEST_FLAG = "--installer-smoke-test";
const installerSmokeTest = process.argv.includes(INSTALLER_SMOKE_TEST_FLAG);
let mainWindow: BrowserWindow | null = null;

// Squirrel launches the app during Windows install/update events so it can
// create or remove shortcuts. Let its helper handle those events without
// opening the dashboard.
if (started) app.quit();

// Before anything resolves userData, so dev never touches the installed app's
// settings or cache. Installer smoke tests also get an isolated directory so
// a self-hosted runner cannot accidentally skip first-time setup.
if (installerSmokeTest) {
  app.setPath(
    "userData",
    path.join(app.getPath("temp"), `practice-activity-smoke-${process.pid}`),
  );
} else {
  applyDevUserDataDirectory();
}

function announceDevEnvironment() {
  if (!isDevEnvironment()) return;
  const sheetUrl = devSheetUrl();
  console.log(`[dev] settings directory: ${app.getPath("userData")}`);
  console.log(
    sheetUrl
      ? `[dev] Practice Log override: ${sheetUrl}`
      : "[dev] no Practice Log override; using saved dev settings",
  );
}

function requireTrustedSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error("Rejected IPC call from an untrusted renderer");
  }
}

function registerIpcHandlers() {
  ipcMain.handle("practice:get-setup-status", event => {
    requireTrustedSender(event);
    return getSetupStatus();
  });

  ipcMain.handle("practice:configure", (event, sheetUrl: unknown, userName: unknown) => {
    requireTrustedSender(event);
    if (typeof sheetUrl !== "string" || sheetUrl.length > 2_048) {
      return {
        ok: false,
        error: {
          code: "invalid_source",
          message: "Enter a valid Google Sheets sharing URL",
        },
      };
    }

    if (userName !== undefined && typeof userName !== "string") {
      return {
        ok: false,
        error: {
          code: "invalid_name",
          message: "Enter a valid name or leave the name field blank",
        },
      };
    }

    const normalizedUserName = typeof userName === "string"
      ? normalizeUserName(userName)
      : null;
    if (normalizedUserName && normalizedUserName.length > MAX_USER_NAME_LENGTH) {
      return {
        ok: false,
        error: {
          code: "invalid_name",
          message: `Name must be ${MAX_USER_NAME_LENGTH} characters or fewer`,
        },
      };
    }

    return configurePracticeLog(sheetUrl, normalizedUserName);
  });

  ipcMain.handle("practice:get-data", event => {
    requireTrustedSender(event);
    return getPracticeData();
  });

  ipcMain.handle("practice:open-sharing-help", async event => {
    requireTrustedSender(event);
    await shell.openExternal(SHARING_HELP_URL);
  });
}

function configureInstallerSmokeTest(window: BrowserWindow) {
  if (!installerSmokeTest) return;

  const timeout = setTimeout(() => {
    console.error("Installer smoke test timed out waiting for the setup screen");
    app.exit(1);
  }, 20_000);

  window.webContents.once("did-finish-load", async () => {
    try {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          if (!window.practiceAPI) throw new Error("preload API not found");

          const status = await window.practiceAPI.getSetupStatus();
          if (status.configured !== false) {
            throw new Error("expected a fresh, unconfigured installation");
          }

          const deadline = Date.now() + 10_000;
          while (Date.now() < deadline) {
            const heading = document.querySelector("#setup-title")?.textContent?.trim();
            if (heading) {
              return {
                heading,
                error: document.querySelector("#setup-error")?.textContent?.trim() ?? null,
              };
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          throw new Error("setup screen not found");
        })()
      `);

      if (result.heading !== "Connect your Practice Log") {
        throw new Error(`Unexpected setup heading: ${String(result.heading)}`);
      }
      if (result.error !== null) {
        throw new Error(`Setup screen reported an error: ${String(result.error)}`);
      }

      console.log("Installer smoke test reached the first-time setup screen");
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      console.error("Installer smoke test failed", error);
      clearTimeout(timeout);
      app.exit(1);
    }
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame) return;
      console.error(
        `Installer smoke test could not load the renderer: ${errorCode} ${errorDescription}`,
      );
      clearTimeout(timeout);
      app.exit(1);
    },
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    show: !installerSmokeTest,
    width: 1_280,
    height: 900,
    minWidth: 840,
    minHeight: 640,
    backgroundColor: "#f4f6f2",
    title: "Practice Activity",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", event => event.preventDefault());
  configureInstallerSmokeTest(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  announceDevEnvironment();
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
