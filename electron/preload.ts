import { contextBridge, ipcRenderer } from "electron";
import type { PracticeAPI } from "../app/electron-api";

const practiceAPI: PracticeAPI = {
  getSetupStatus: () => ipcRenderer.invoke("practice:get-setup-status"),
  configurePracticeLog: sheetUrl => ipcRenderer.invoke("practice:configure", sheetUrl),
  getPracticeData: () => ipcRenderer.invoke("practice:get-data"),
  openSharingHelp: () => ipcRenderer.invoke("practice:open-sharing-help"),
};

contextBridge.exposeInMainWorld("practiceAPI", practiceAPI);
