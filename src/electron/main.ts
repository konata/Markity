import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const markdown = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;
const filters = [{ name: "Markdown", extensions: ["md", "mdx", "mdc", "mkd", "markdown", "txt"] }];

let window: BrowserWindow | undefined;
let pending = process.argv.find(path => markdown.test(path));

app.whenReady().then(() => {
  window = create();
  menu();
});

app.on("open-file", (event, path) => {
  event.preventDefault();
  if (window) void open(window, path);
  else pending = path;
});

app.on("activate", () => {
  if (!BrowserWindow.getAllWindows().length) window = create();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("pick", async event => {
  const page = BrowserWindow.fromWebContents(event.sender) ?? window;
  const picked = await dialog.showOpenDialog(page!, { properties: ["openFile"], filters });
  return picked.canceled ? undefined : file(picked.filePaths[0]);
});

ipcMain.handle("initial", () => pending ? file(pending) : undefined);
ipcMain.handle("read", (_event, path: string) => file(path));
ipcMain.handle("folder", (_event, path: string, root: string, active: string) => folder(path, root, active));

function create() {
  const page = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: "#fffdf8",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(__dirname, "preload.cjs")
    }
  });
  page.loadFile(join(__dirname, "electron.html"));
  return page;
}

function menu() {
  const file: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      { label: "Open...", accelerator: "CmdOrCtrl+O", click: () => window && pick(window) },
      { type: "separator" },
      { role: "close" }
    ]
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: app.name, submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }] },
    file,
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" }
  ]));
}

async function pick(page: BrowserWindow) {
  const picked = await dialog.showOpenDialog(page, { properties: ["openFile"], filters });
  if (!picked.canceled) await open(page, picked.filePaths[0]);
}

async function open(page: BrowserWindow, path: string) {
  page.webContents.send("open", await file(path));
}

async function file(path: string) {
  return { path, root: dirname(path), markdown: await readFile(path, "utf8") };
}

async function folder(source: string, root: string, active: string) {
  const place = await stat(source).then(info => info.isDirectory() ? source : dirname(source));
  const entries = (await readdir(place, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() || markdown.test(entry.name))
    .map(entry => {
      const path = join(place, entry.name);
      return { title: entry.name, href: path, folder: entry.isDirectory(), active: resolve(path) === resolve(active) };
    })
    .sort((left, right) => Number(right.folder) - Number(left.folder) || left.title.localeCompare(right.title));

  return resolve(place) === resolve(root) ? entries : [{ title: "..", href: dirname(place), folder: true, active: false }, ...entries];
}
