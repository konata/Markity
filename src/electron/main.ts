import { app, BrowserWindow, dialog, ipcMain, Menu, type MenuItemConstructorOptions } from "electron";
import { constants, statSync } from "node:fs";
import { access, chmod, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const markdown = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;
const filters = [{ name: "Markdown", extensions: ["md", "mdx", "mdc", "mkd", "markdown", "txt"] }];

let window: BrowserWindow | undefined;
let pending = process.argv.slice(process.defaultApp ? 2 : 1).find(input);

app.whenReady().then(async () => {
  if (await place()) return;
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
  const picked = await dialog.showOpenDialog(page!, { properties: ["openFile", "openDirectory"], filters });
  return picked.canceled ? undefined : source(picked.filePaths[0]);
});

ipcMain.handle("initial", () => pending ? source(pending) : undefined);
ipcMain.handle("read", (_event, path: string) => source(path));
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
      { label: "Install CLI", click: () => void install() },
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

async function place() {
  if (process.platform !== "darwin" || !app.isPackaged || app.isInApplicationsFolder()) return false;
  const { response } = await dialog.showMessageBox({
    type: "question",
    buttons: ["Move to Applications", "Not Now"],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    message: "Move Markity to Applications?",
    detail: "Markity can install itself in Applications before opening."
  });
  if (response !== 0) return false;

  try {
    return app.moveToApplicationsFolder();
  } catch (error) {
    dialog.showErrorBox("Install failed", error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function pick(page: BrowserWindow) {
  const picked = await dialog.showOpenDialog(page, { properties: ["openFile", "openDirectory"], filters });
  if (!picked.canceled) await open(page, picked.filePaths[0]);
}

async function install() {
  try {
    const bin = await cli();
    const bundle = dirname(dirname(dirname(process.execPath)));
    await writeFile(bin, `#!/bin/zsh
app=${JSON.stringify(bundle)}
args=(${app.isPackaged ? "" : JSON.stringify(process.cwd())})
for path in "$@"; do
  [[ "$path" = /* ]] && args+=("$path") || args+=("$PWD/$path")
done
exec open -n "$app" --args "\${args[@]}"
`);
    await chmod(bin, 0o755);
    await dialog.showMessageBox(window!, { type: "info", message: "CLI installed", detail: `${bin}\n\nmty path/to/file.md` });
  } catch (error) {
    dialog.showErrorBox("CLI install failed", error instanceof Error ? error.message : String(error));
  }
}

async function cli() {
  try {
    await access("/usr/local/bin", constants.W_OK);
    return "/usr/local/bin/mty";
  } catch {
    const path = join(homedir(), ".local/bin");
    await mkdir(path, { recursive: true });
    return join(path, "mty");
  }
}

async function open(page: BrowserWindow, path: string) {
  page.webContents.send("open", await source(path));
}

async function source(path: string) {
  const info = await stat(path);
  return info.isDirectory() ? { path, root: path, folder: true } : { path, root: dirname(path), markdown: await readFile(path, "utf8") };
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

function input(path: string) {
  if (path.startsWith("-")) return false;
  try {
    return statSync(path).isDirectory() || markdown.test(path);
  } catch {
    return markdown.test(path);
  }
}
