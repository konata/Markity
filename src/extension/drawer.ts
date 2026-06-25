import drawerSource from "./drawer.css?raw";

export type Drawer = { folder: boolean; outline: boolean };
export type Chapter = { id: string; level: number; text: string };
export type FolderEntry = { title: string; href: string; folder: boolean; active: boolean };
export type Folder = { entries: FolderEntry[]; loading?: boolean; message?: string };

type Options = {
  title: string;
  chapters: Chapter[];
  folder: Folder;
  state: Drawer;
  onState: (state: Drawer) => void;
  onFolder?: () => void;
  onOpen?: (entry: FolderEntry) => void;
};

const markdown = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;
const headings = ".document-wrapper h1, .document-wrapper h2, .document-wrapper h3, .document-wrapper h4, .document-wrapper h5, .document-wrapper h6";

export const defaultDrawer = (): Drawer => ({ folder: false, outline: false });

export function chapters(root: ParentNode): Chapter[] {
  return [...root.querySelectorAll<HTMLElement>(headings)]
    .map(heading => ({ id: heading.id, level: Number(heading.tagName.slice(1)), text: heading.textContent?.trim() ?? "" }))
    .filter(({ id, text }) => id && text);
}

export async function folder(source = location.href, html?: string, root = new URL(".", source).href): Promise<FolderEntry[]> {
  const target = clean(new URL(source, location.href));
  const directory = target.pathname.endsWith("/") ? target : new URL(".", target);
  const file = target.pathname.endsWith("/") ? undefined : target;
  const seen = new Set<string>();
  const entries = rows(html ?? "", directory, file)
    .filter(entry => entry.title && entry.href !== directory.href && entry.href.startsWith(directory.href))
    .filter(entry => entry.folder || markdown.test(decodeURIComponent(new URL(entry.href).pathname)))
    .filter(entry => !seen.has(entry.href) && Boolean(seen.add(entry.href)))
    .sort((left, right) => Number(right.folder) - Number(left.folder) || left.title.localeCompare(right.title));

  return directory.href === new URL(root, location.href).href ? entries : [parent(directory), ...entries];
}

export function folderMessage(error: unknown, source = location.href) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return new URL(source, location.href).protocol === "file:" ? "Enable Allow access to file URLs for Markity, then reopen this Markdown file." : "This URL does not expose a folder listing.";
  }
  return error instanceof Error ? error.message : "Folder is unavailable for this URL.";
}

export function createDrawers({ title, chapters, folder, state, onState, onFolder, onOpen }: Options) {
  if (state.folder && !folder.loading && !folder.message && !folder.entries.length) queueMicrotask(() => onFolder?.());
  return [
    panel("folder", "Folder", folderView(folder, onOpen), () => onState({ ...state, folder: false })),
    toggle("folder", state.folder, () => onState({ ...state, folder: !state.folder })),
    panel("outline", "Outline", outlineView(title, chapters), () => onState({ ...state, outline: false })),
    toggle("outline", state.outline, () => onState({ ...state, outline: !state.outline }))
  ];
}

export function trackOutline(list: Chapter[]) {
  if (!list.length) return () => undefined;

  const update = () => {
    let active = list[0];
    for (const chapter of list) {
      if ((document.getElementById(chapter.id)?.getBoundingClientRect().top ?? Infinity) <= 110) active = chapter;
    }
    document.querySelectorAll<HTMLElement>("[data-markity-heading]").forEach(link => link.toggleAttribute("aria-current", link.dataset.markityHeading === active.id));
  };

  update();
  addEventListener("scroll", update, { passive: true });
  addEventListener("hashchange", update);
  return () => {
    removeEventListener("scroll", update);
    removeEventListener("hashchange", update);
  };
}

export function markMarquee(root: ParentNode = document) {
  requestAnimationFrame(() => root.querySelectorAll<HTMLElement>(".markity-outline-text").forEach(label => {
    const distance = Math.max(0, Math.ceil(label.scrollWidth - (label.parentElement?.clientWidth ?? 0) + 24));
    label.style.setProperty("--markity-marquee-distance", `${distance}px`);
    label.toggleAttribute("data-markity-marquee", distance > 24);
  }));
}

export const drawerCss = drawerSource;

function rows(html: string, directory: URL, file?: URL) {
  const page = new DOMParser().parseFromString(html, "text/html");
  const anchors = [...page.querySelectorAll<HTMLAnchorElement>("a[href]")].map(anchor => entry(anchor.getAttribute("href") ?? "", anchor.textContent?.trim() ?? "", directory, file));
  return anchors.length ? anchors : [...html.matchAll(/addRow\("((?:\\.|[^"\\])*)","((?:\\.|[^"\\])*)",(\d+)/g)].map(([, title, href, folder]) => entry(JSON.parse(`"${href}"`), JSON.parse(`"${title}"`), directory, file, folder === "1"));
}

function entry(path: string, name: string, directory: URL, file?: URL, forceFolder = false): FolderEntry {
  const href = clean(new URL(path, directory.href));
  const folder = forceFolder || href.pathname.endsWith("/");
  if (folder && !href.pathname.endsWith("/")) href.pathname += "/";
  const title = (name || decodeURIComponent(href.pathname.split("/").filter(Boolean).at(-1) ?? "")).replace(/\/$/, "");
  return { title, href: href.href, folder, active: href.pathname === file?.pathname };
}

function parent(directory: URL): FolderEntry {
  return { title: "..", href: new URL("..", directory).href, folder: true, active: false };
}

function clean(url: URL) {
  url.hash = "";
  url.search = "";
  return url;
}

function panel(kind: "folder" | "outline", title: string, content: HTMLElement, close: () => void) {
  const aside = document.createElement("aside");
  aside.id = `markity-${kind}-drawer`;
  aside.className = "markity-drawer";
  aside.ariaLabel = title;

  const head = document.createElement("header");
  head.className = "markity-drawer-head";
  head.innerHTML = `<span class="markity-drawer-title">${icon(kind)}<span>${title}</span></span>`;
  head.append(button("markity-drawer-close", kind === "folder" ? "chevron-left" : "chevron-right", `Hide ${title.toLowerCase()}`, close));

  const body = document.createElement("div");
  body.className = "markity-drawer-body";
  body.append(content);
  aside.append(head, body);
  return aside;
}

function toggle(kind: "folder" | "outline", active: boolean, click: () => void) {
  const control = button("markity-drawer-toggle", kind, `${active ? "Hide" : "Show"} ${kind}`, click);
  control.id = `markity-${kind}-toggle`;
  control.setAttribute("aria-expanded", String(active));
  return control;
}

function button(className: string, glyph: Icon, title: string, click: () => void) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = className;
  control.title = title;
  control.ariaLabel = title;
  control.innerHTML = icon(glyph);
  control.addEventListener("click", click);
  return control;
}

function outlineView(title: string, list: Chapter[]) {
  const view = document.createElement("div");
  view.className = "markity-outline";
  if (!list.length) return view.append(message("No outline in this document.")), view;

  const [first, ...rest] = list;
  view.append(outlineLink(first.id, first.text || title, "markity-outline-title"));
  rest.forEach(({ id, level, text }) => view.append(outlineLink(id, text, `markity-outline-link markity-outline-level-${level}`)));
  return view;
}

function outlineLink(id: string, text: string, className: string) {
  const link = document.createElement("a");
  link.className = className;
  link.href = `#${encodeURIComponent(id)}`;
  link.dataset.markityHeading = id;
  link.innerHTML = `<span class="markity-outline-text"></span>`;
  link.firstElementChild!.textContent = text;
  return link;
}

function folderView(folder: Folder, open?: (entry: FolderEntry) => void) {
  const view = document.createElement("div");
  view.className = "markity-folder";
  if (folder.loading || folder.message || !folder.entries.length) return view.append(message(folder.loading ? "Loading folder..." : folder.message ?? "No Markdown files in this folder.")), view;

  folder.entries.forEach(entry => {
    const link = document.createElement("a");
    link.className = "markity-folder-link";
    link.href = entry.href;
    link.toggleAttribute("aria-current", entry.active);
    link.innerHTML = `<span class="markity-folder-icon">${icon(entry.folder ? "folder" : "file")}</span>`;
    link.append(document.createTextNode(entry.title));
    if (open) link.addEventListener("click", event => (event.preventDefault(), open(entry)));
    view.append(link);
  });
  return view;
}

function message(text: string) {
  const paragraph = document.createElement("p");
  paragraph.className = "markity-folder-message";
  paragraph.textContent = text;
  return paragraph;
}

type Icon = "folder" | "outline" | "file" | "chevron-left" | "chevron-right";
function icon(name: Icon) {
  const stroke = `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`;
  const paths: Record<Icon, string> = {
    folder: `<path ${stroke} d="M3.5 7.5a2 2 0 0 1 2-2h4.2l2 2h6.8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>`,
    file: `<path ${stroke} d="M7 3.8h6.2L18 8.6v11.6H7Z"/><path ${stroke} d="M13 4v5h5"/>`,
    outline: `<path ${stroke} d="M8 6h8M6 12h12M9 18h6"/>`,
    "chevron-left": `<path ${stroke} d="m15 6-6 6 6 6"/>`,
    "chevron-right": `<path ${stroke} d="m9 6 6 6-6 6"/>`
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`;
}
