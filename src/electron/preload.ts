import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("markity", {
  initial: () => ipcRenderer.invoke("initial"),
  pick: () => ipcRenderer.invoke("pick"),
  read: (path: string) => ipcRenderer.invoke("read", path),
  folder: (path: string, root: string, active: string) => ipcRenderer.invoke("folder", path, root, active),
  onOpen: (open: (document: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, document: unknown) => open(document);
    ipcRenderer.on("open", listener);
    return () => ipcRenderer.removeListener("open", listener);
  }
});
