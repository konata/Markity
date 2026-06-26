import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Source = { path: string; root: string; markdown: string } | { path: string; root: string; folder: true };
type FolderEntry = { title: string; href: string; folder: boolean; active: boolean };

let opened: ((source: Source) => void) | undefined;

const bridge = {
  initial: () => invoke<Source | undefined>("initial"),
  pick: () => invoke<Source | undefined>("pick"),
  read: (path: string) => invoke<Source>("read", { path }),
  folder: (path: string, root: string, active: string) => invoke<FolderEntry[]>("folder", { path, root, active }),
  asset: (path: string) => convertFileSrc(path),
  external: (url: string) => invoke("external", { url }),
  onOpen(open: (source: Source) => void) {
    opened = open;
    const unlisten = listen<Source>("open", event => open(event.payload));
    return () => {
      opened = undefined;
      void unlisten.then(off => off());
    };
  },
  theme: (mode: "system" | "light" | "dark") => void getCurrentWindow().setTheme(mode === "system" ? null : mode)
};

(window as unknown as { markity: typeof bridge }).markity = bridge;

void getCurrentWindow().onDragDropEvent(async event => {
  if (event.payload.type !== "drop") return;
  const path = event.payload.paths[0];
  if (path && opened) opened(await invoke<Source>("read", { path }));
});
