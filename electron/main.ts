import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import {
  configurePracticeLog,
  getPracticeData,
  getSetupStatus,
} from "./practice-service";

const SHARING_HELP_URL = "https://support.google.com/drive/answer/2494822";
let mainWindow: BrowserWindow | null = null;

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

  ipcMain.handle("practice:configure", (event, sheetUrl: unknown) => {
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
    return configurePracticeLog(sheetUrl);
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

function createWindow() {
  mainWindow = new BrowserWindow({
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
  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
