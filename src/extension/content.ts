import { api } from "./api";
import { createDrawers, defaultDrawer, drawerCss, chapters, folder, folderMessage, markMarquee, trackOutline, type Drawer, type Folder, type FolderEntry } from "./drawer";
import { document as render } from "../render/document";
import type { ThemeMode } from "../render/theme";

type Message = { action?: string; theme?: ThemeMode; target?: string };
type Worker = { ok?: boolean; html?: string; error?: string };

const markdownPath = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;
const curtain = document.createElement("style");

let markdown = "";
let title = "Markdown";
let theme: ThemeMode = "light";
let raw = false;
let drawer: Drawer = defaultDrawer();
let directory: Folder = { entries: [] };
let root = "";
let path = "";
let untrack: () => void = () => undefined;

async function boot() {
  document.documentElement.dataset.markity = "loading";
  curtain.textContent = "html[data-markity='loading'] body{visibility:hidden!important}";
  document.documentElement.append(curtain);
  api.runtime?.onMessage.addListener(messages);

  try {
    if (!document.body) await new Promise<void>(done => document.addEventListener("DOMContentLoaded", () => done(), { once: true }));

    markdown = snapshot();
    if (!markdown) {
      delete document.documentElement.dataset.markity;
      return;
    }

    title = filename();
    root = path = new URL(".", location.href).href;
    const fallback = defaultDrawer();
    const stored = await api.storage.local.get({ theme: "light", folder: fallback.folder, outline: fallback.outline });
    theme = stored.theme as ThemeMode;
    drawer = { folder: Boolean(stored.folder), outline: Boolean(stored.outline) };
    show();
    addEventListener("keydown", keys);
    document.documentElement.dataset.markity = "ready";
  } catch (error) {
    document.documentElement.dataset.markity = "failed";
    console.error("[Markity]", error);
  } finally {
    curtain.remove();
  }
}

function messages(message: Message, _sender: chrome.runtime.MessageSender, reply: (response?: unknown) => void) {
  if (message?.target !== "markity") return;
  handle(message).then(reply);
  return true;
}

async function handle({ action, theme: value }: Message) {
  if (!markdown) return { ok: false, error: "No Markdown document is active." };
  if (action === "status") return status();
  if (action === "reload") return location.reload(), status();

  if (action === "raw") raw = !raw;
  else if (action === "theme") theme = next(theme);
  else if (action === "set-theme" && value) theme = value;
  else if (action === "folder") drawer.folder = !drawer.folder;
  else if (action === "outline") drawer.outline = !drawer.outline;
  else return status();

  await save();
  show();
  return status();
}

function show() {
  untrack();
  if (raw) return showRaw();

  const page = render(markdown, theme, title);
  const article = document.createElement("main");
  article.id = "markity-root";
  article.innerHTML = page.html;

  const outline = chapters(article);
  style().textContent = `${page.css}\n${drawerCss}`;
  document.title = page.title;
  document.body.className = classes();
  document.body.replaceChildren(...createDrawers({
    title,
    chapters: outline,
    folder: directory,
    state: drawer,
    onState: state => (drawer = state, save().then(show)),
    onFolder: () => void load(),
    onOpen: entry => void open(entry)
  }), article);
  markMarquee(document.body);
  untrack = trackOutline(outline);
}

function showRaw() {
  const article = document.createElement("main");
  const code = document.createElement("pre");
  article.id = "markity-root";
  code.id = "markity-raw";
  code.textContent = markdown;
  article.append(code);
  style().textContent = `html,body{min-height:100%}body.markity-raw{margin:0;background:#fff;color:#444}#markity-raw{box-sizing:border-box;width:min(720px,100%);margin:8px auto;padding:0 30px;white-space:pre-wrap;overflow-wrap:anywhere;font:13.65px/1.755 "Menlo-Regular",monospace}`;
  document.title = `${title} - Raw`;
  document.body.className = `markity-raw markity-theme-${theme}`;
  document.body.replaceChildren(article);
}

async function load(target = path) {
  if (directory.loading) return;
  path = target;
  directory = { entries: [], loading: true };
  show();

  try {
    const entries = await folder(target, await listing(target), root);
    directory = { entries, message: entries.length ? undefined : "No Markdown files in this folder." };
  } catch (error) {
    directory = { entries: [], message: folderMessage(error) };
  }

  show();
}

async function listing(href: string) {
  if (!local()) return undefined;
  const response = await api.runtime.sendMessage({ target: "markity-worker", action: "folder", href }) as Worker;
  if (response?.ok) return response.html;
  throw new Error(response?.error ?? "Folder is unavailable for this URL.");
}

async function open(entry: FolderEntry) {
  if (entry.folder) return load(entry.href);
  if (!local(entry.href)) return void (location.href = entry.href);
  const response = await api.runtime.sendMessage({ target: "markity-worker", action: "open", href: entry.href }) as Worker;
  if (!response?.ok) location.href = entry.href;
}

async function keys(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || editing(event.target)) return;

  const key = event.key.toLowerCase();
  if (key === "j" || key === "k") return scroll(event, key === "j" ? 1 : -1);
  if (key === "t") theme = next(theme);
  else if (key === "f") drawer.folder = !drawer.folder;
  else return;

  event.preventDefault();
  await save();
  show();
}

function snapshot() {
  const pre = document.body.childElementCount === 1 && document.body.firstElementChild?.tagName === "PRE" ? document.body.firstElementChild : undefined;
  if (pre?.textContent?.trim()) return pre.textContent;
  if (!document.contentType.startsWith("text/") && location.protocol !== "file:") return "";
  return document.body.innerText.trim() ? document.body.innerText : "";
}

function style() {
  const existing = document.querySelector<HTMLStyleElement>("#markity-style");
  if (existing) return existing;
  const element = document.createElement("style");
  element.id = "markity-style";
  document.head.append(element);
  return element;
}

const save = () => api.storage.local.set({ theme, folder: drawer.folder, outline: drawer.outline });
const next = (value: ThemeMode): ThemeMode => value === "system" ? "light" : value === "light" ? "dark" : "system";
const status = () => ({ ok: true, raw, theme, title, folder: drawer.folder, outline: drawer.outline });
const local = (href = location.href) => new URL(href, location.href).protocol === "file:";
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const scroll = (event: KeyboardEvent, direction: 1 | -1) => (event.preventDefault(), scrollBy({ top: direction * Math.min(120, Math.max(72, innerHeight * 0.12)) }));
const classes = () => ["markity", `markity-theme-${theme}`, drawer.folder && "markity-folder-open", drawer.outline && "markity-outline-open"].filter(Boolean).join(" ");
const filename = () => decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "Markdown").replace(markdownPath, "") || "Markdown";

if (markdownPath.test(location.pathname)) void boot();
