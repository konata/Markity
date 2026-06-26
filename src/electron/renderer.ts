import "./renderer.css";
import { createDrawers, defaultDrawer, drawerCss, chapters, markMarquee, trackOutline, type Drawer, type Folder, type FolderEntry } from "../extension/drawer";
import { document as render } from "../render/document";
import type { ThemeMode } from "../render/theme";
import iconSvg from "../../site/assets/icon.svg?raw";

const feather = `<svg viewBox="0 0 1024 1024" fill="currentColor" aria-hidden="true"><path d="M1020.319744 102.4a3.7376 3.7376 0 0 1 1.3312 7.2704 196.7616 196.7616 0 0 0-105.5232 84.1728c-48.384 80.384-53.5552 161.9456-137.6768 175.7696s-109.6192 20.224-116.4288 30.72l115.3024 20.48a302.08 302.08 0 0 1-90.624 103.168 482.1504 482.1504 0 0 1-137.2672 56.32 537.088 537.088 0 0 0 80.6912 18.7392s-108.4928 128.9216-341.76 113.2544a177.0496 177.0496 0 0 0 79.9232 31.6928 387.9424 387.9424 0 0 1-160.8192 49.3568 259.3792 259.3792 0 0 0 77.8752 4.2496 211.0464 211.0464 0 0 1-144.9472 34.3552s271.36-382.1056 534.784-554.1376c0 0-312.832 159.232-664.5248 673.0752 0 0-10.9568 3.8912-10.6496-8.6528s125.6448-220.5184 125.6448-220.5184a350.3616 350.3616 0 0 1 19.2-138.24 197.7344 197.7344 0 0 0 17.8176 77.6192 504.2176 504.2176 0 0 1 54.2208-176.5376 277.4528 277.4528 0 0 0 9.4208 126.3104 574.9248 574.9248 0 0 1 59.904-208.384 467.2512 467.2512 0 0 0 1.3824 114.3808S546.770944 107.4688 1020.319744 102.4z"/></svg>`;

type Document = { path: string; root: string; markdown: string };
type Source = Document | { path: string; root: string; folder: true };
type Recent = { title: string; path: string };
type Bridge = {
  initial(): Promise<Source | undefined>;
  pick(): Promise<Source | undefined>;
  read(path: string): Promise<Source>;
  folder(path: string, root: string, active: string): Promise<FolderEntry[]>;
  onOpen(open: (source: Source) => void): () => void;
};

const bridge = (window as unknown as Window & { markity: Bridge }).markity;
const app = document.querySelector<HTMLElement>("#app")!;

let current: Source | undefined;
let title = "Markdown";
let theme = localStorage.markityThemeV2 as ThemeMode || "light";
let raw = false;
let drawer: Drawer = JSON.parse(localStorage.markityDrawerV2 ?? "null") ?? defaultDrawer();
let recent: Recent[] = JSON.parse(localStorage.markityRecent ?? "[]");
let directory: Folder = { entries: [] };
let path = "";
let untrack: () => void = () => {};

bridge.onOpen(open);
addEventListener("keydown", keys);
addEventListener("dragover", event => event.preventDefault());
addEventListener("drop", event => {
  event.preventDefault();
  const file = event.dataTransfer?.files[0] as (File & { path?: string }) | undefined;
  if (file?.path) void read(file.path);
});
app.addEventListener("click", link);

void boot();

async function boot() {
  const source = await bridge.initial();
  if (source) await open(source);
  else show();
}

async function choose() {
  const source = await bridge.pick();
  if (source) await open(source);
}

async function read(file: string, root?: string) {
  const source = await bridge.read(file);
  await open(root && !folder(source) ? { ...source, root } : source);
}

async function open(source: Source) {
  current = source;
  title = filename(source.path);
  if (!folder(source)) remember(source.path);
  path = source.path;
  raw = false;
  if (folder(source)) drawer = { folder: true, outline: false };
  await load(path);
}

function show() {
  untrack();
  if (!current) return empty();
  if (folder(current)) return showFolder();
  if (raw) return showRaw();

  const page = render(current.markdown, theme, title);
  const article = document.createElement("main");
  article.id = "markity-root";
  article.innerHTML = page.html;

  const outline = chapters(article);
  style().textContent = `${page.css}\n${drawerCss}`;
  document.title = page.title;
  document.body.className = classes();
  app.replaceChildren(...createDrawers({
    title,
    chapters: outline,
    folder: directory,
    state: drawer,
    onState: state => (drawer = state, save(), show()),
    onFolder: () => void load(),
    onOpen: entry => void select(entry)
  }), article);
  markMarquee(app);
  untrack = trackOutline(outline);
}

function showFolder() {
  const state = { folder: true, outline: false };
  const article = document.createElement("main");
  article.id = "markity-root";
  article.className = "markity-folder-home";
  article.innerHTML = `<div class="markity-folder-brand">${feather}</div>`;

  style().textContent = drawerCss;
  document.title = title;
  document.body.className = `${classes(state)} markity-directory`;
  app.replaceChildren(...createDrawers({
    title,
    chapters: [],
    folder: directory,
    state,
    onState: state => (drawer = { folder: state.folder, outline: false }, save(), show()),
    onFolder: () => void load(),
    onOpen: entry => void select(entry)
  }).filter(node => !node.id.includes("outline")), article);
}

function empty() {
  style().textContent = "";
  document.title = "Markity";
  document.body.className = "markity-empty";
  app.innerHTML = `<section class="markity-home"><div class="markity-logo">${iconSvg}</div><div class="markity-start"><h2>Start</h2><nav class="markity-menu"><button class="markity-open" type="button"><span>Open...</span><kbd>⌘O</kbd></button></nav></div><div class="markity-recent"></div></section>`;
  app.querySelector("button")!.addEventListener("click", () => void choose());

  const list = app.querySelector<HTMLElement>(".markity-recent")!;
  if (!recent.length) return;
  const heading = document.createElement("h2");
  heading.textContent = "Recent";
  list.replaceChildren(heading, ...recent.map(file => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "markity-recent-file";
    button.innerHTML = `<span></span><small></small>`;
    button.firstElementChild!.textContent = file.title;
    button.lastElementChild!.textContent = file.path;
    button.addEventListener("click", () => void read(file.path));
    return button;
  }));
}

function showRaw() {
  const article = document.createElement("main");
  const code = document.createElement("pre");
  article.id = "markity-root";
  code.id = "markity-raw";
  code.textContent = (current as Document).markdown;
  article.append(code);
  style().textContent = `html,body{min-height:100%}body.markity-raw{margin:0;background:#fff;color:#444}`;
  document.title = `${title} - Raw`;
  document.body.className = `markity-raw markity-theme-${theme}`;
  app.replaceChildren(article);
}

async function load(target = path) {
  if (!current || directory.loading) return;
  path = target;
  directory = { entries: [], loading: true };
  show();

  try {
    const entries = await bridge.folder(target, current.root, current.path);
    directory = { entries, message: entries.length ? undefined : "No Markdown files in this folder." };
  } catch (error) {
    directory = { entries: [], message: error instanceof Error ? error.message : "Folder is unavailable." };
  }

  show();
}

async function select(entry: FolderEntry) {
  if (entry.folder) return load(entry.href);
  await read(entry.href, current?.root);
}

function link(event: MouseEvent) {
  if (event.defaultPrevented || !current || folder(current)) return;
  const href = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]")?.getAttribute("href");
  if (!href || href.startsWith("#") || (/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("file:"))) return;
  const target = decodeURIComponent(new URL(href, `file://${encodeURI(current.path)}`).pathname);
  if (!mdFile.test(target)) return;
  event.preventDefault();
  void read(target, current.root);
}

async function keys(event: KeyboardEvent) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || editing(event.target)) return;
  const key = event.key.toLowerCase();

  if (event.metaKey && key === "o") return event.preventDefault(), choose();
  if (event.metaKey) return;
  if (key === "j" || key === "k") return scroll(event, key === "j" ? 1 : -1);
  if (key === "t") theme = next(theme);
  else if (key === "f") drawer.folder = !drawer.folder;
  else return;

  event.preventDefault();
  save();
  show();
}

function style() {
  const existing = document.querySelector<HTMLStyleElement>("#markity-style");
  if (existing) return existing;
  const element = document.createElement("style");
  element.id = "markity-style";
  document.head.append(element);
  return element;
}

function save() {
  localStorage.markityThemeV2 = theme;
  localStorage.markityDrawerV2 = JSON.stringify(drawer);
}

function remember(path: string) {
  recent = [{ title: filename(path), path }, ...recent.filter(file => file.path !== path)].slice(0, 8);
  localStorage.markityRecent = JSON.stringify(recent);
}

const folder = (source: Source): source is Extract<Source, { folder: true }> => "folder" in source;
const mdFile = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;
const next = (value: ThemeMode): ThemeMode => value === "system" ? "light" : value === "light" ? "dark" : "system";
const filename = (file: string) => decodeURIComponent(file.split("/").filter(Boolean).at(-1) ?? "Markdown").replace(/\.(md|mdx|mdc|mkd|markdown|txt)$/i, "") || "Markdown";
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const scroll = (event: KeyboardEvent, direction: 1 | -1) => (event.preventDefault(), scrollBy({ top: direction * Math.min(120, Math.max(72, innerHeight * 0.12)) }));
const classes = (state = drawer) => ["markity", `markity-theme-${theme}`, state.folder && "markity-folder-open", state.outline && "markity-outline-open"].filter(Boolean).join(" ");
