import "./renderer.css";
import { createDrawers, defaultDrawer, drawerCss, chapters, markMarquee, trackOutline, type Drawer, type Folder, type FolderEntry } from "../extension/drawer";
import { document as render } from "../render/document";
import type { ThemeMode } from "../render/theme";

type Document = { path: string; root: string; markdown: string };
type Recent = { title: string; path: string };
type Bridge = {
  initial(): Promise<Document | undefined>;
  pick(): Promise<Document | undefined>;
  read(path: string): Promise<Document>;
  folder(path: string, root: string, active: string): Promise<FolderEntry[]>;
  onOpen(open: (document: Document) => void): () => void;
};

const bridge = (window as unknown as Window & { markity: Bridge }).markity;
const app = document.querySelector<HTMLElement>("#app")!;

let current: Document | undefined;
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

void boot();

async function boot() {
  const document = await bridge.initial();
  if (document) await open(document);
  else show();
}

async function choose() {
  const document = await bridge.pick();
  if (document) await open(document);
}

async function read(file: string, root = current?.root) {
  const document = await bridge.read(file);
  await open(root ? { ...document, root } : document);
}

async function open(document: Document) {
  current = document;
  title = filename(document.path);
  remember(document.path);
  path = document.path;
  raw = false;
  await load(path);
}

function show() {
  untrack();
  if (!current) return empty();
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

function empty() {
  style().textContent = "";
  document.title = "Markity";
  document.body.className = "markity-empty";
  app.innerHTML = `<section class="markity-home"><div class="markity-logo">M</div><button class="markity-open" type="button"><span>Open</span><kbd>⌘O</kbd></button><div class="markity-recent"></div></section>`;
  app.querySelector("button")!.addEventListener("click", () => void choose());

  const list = app.querySelector<HTMLElement>(".markity-recent")!;
  if (!recent.length) return;
  list.replaceChildren(...recent.map(file => {
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
  code.textContent = current!.markdown;
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
  await read(entry.href);
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

const next = (value: ThemeMode): ThemeMode => value === "system" ? "light" : value === "light" ? "dark" : "system";
const filename = (file: string) => decodeURIComponent(file.split("/").filter(Boolean).at(-1) ?? "Markdown").replace(/\.(md|mdx|mdc|mkd|markdown|txt)$/i, "") || "Markdown";
const editing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
const scroll = (event: KeyboardEvent, direction: 1 | -1) => (event.preventDefault(), scrollBy({ top: direction * Math.min(120, Math.max(72, innerHeight * 0.12)) }));
const classes = () => ["markity", `markity-theme-${theme}`, drawer.folder && "markity-folder-open", drawer.outline && "markity-outline-open"].filter(Boolean).join(" ");
