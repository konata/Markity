import { api } from "../extension/api";
import "./popup.css";

type Theme = "system" | "light" | "dark";
type State = { ok?: boolean; raw?: boolean; theme?: Theme; title?: string; folder?: boolean; outline?: boolean; error?: string };

const state = document.querySelector<HTMLElement>("#state")!;
const theme = document.querySelector<HTMLSelectElement>("#theme")!;
const folder = document.querySelector<HTMLButtonElement>("#folder")!;
const outline = document.querySelector<HTMLButtonElement>("#outline")!;
const raw = document.querySelector<HTMLButtonElement>("#raw")!;
const reload = document.querySelector<HTMLButtonElement>("#reload")!;
const controls = [folder, outline, raw, reload];

boot();

for (const [control, action] of [[folder, "folder"], [outline, "outline"], [raw, "raw"], [reload, "reload"]] as const) {
  control.addEventListener("click", () => send(action));
}

theme.addEventListener("change", async () => {
  const value = theme.value as Theme;
  await api.storage.local.set({ theme: value });
  await send("set-theme", { theme: value });
});

async function boot() {
  const stored = await api.storage.local.get({ theme: "system" });
  theme.value = stored.theme;
  paint(await send("status", {}, false));
}

async function send(action: string, payload: Record<string, unknown> = {}, paintState = true) {
  const response = (await api.runtime.sendMessage({ target: "markity", action, ...payload }).catch(error => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }))) as State;
  if (paintState) paint(response);
  return response;
}

function paint(response: State) {
  controls.forEach(control => control.disabled = !response?.ok);
  if (!response?.ok) {
    state.textContent = "No active Markity page";
    return;
  }

  state.textContent = response.raw ? `${response.title} - raw` : response.title ?? "Rendered";
  folder.textContent = response.folder ? "Hide folder" : "Show folder";
  outline.textContent = response.outline ? "Hide outline" : "Show outline";
  raw.textContent = response.raw ? "Rendered" : "Raw";
  if (response.theme) theme.value = response.theme;
}
