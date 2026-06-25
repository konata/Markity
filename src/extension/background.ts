import { api } from "./api";

const markdown = /\.(md|mdx|mdc|mkd|markdown|txt)$/i;

api.tabs.onUpdated.addListener((tab, change, page) => {
  if (change.status === "complete" && page.url && local(page.url)) void inject(tab);
});

api.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.target === "markity-worker" && message.action === "folder") folder(String(message.href)).then(reply);
  else if (message?.target === "markity-worker" && message.action === "open") open(String(message.href), sender.tab?.id).then(reply);
  else if (message?.target === "markity") dispatch(message.action, message).then(reply);
  else return;
  return true;
});

async function inject(tab: number) {
  try {
    const [page] = await api.scripting.executeScript({
      target: { tabId: tab },
      func: () => Boolean(document.documentElement.dataset.markity)
    });
    if (page?.result) return;
    await api.scripting.executeScript({ target: { tabId: tab }, files: ["content.js"] });
  } catch {}
}

async function folder(href: string) {
  try {
    const response = await fetch(href);
    if (!response.ok && response.status !== 0) return { ok: false, error: `Folder request failed: ${response.status}` };
    return { ok: true, html: await response.text() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function open(href: string, tab: number | undefined) {
  if (!tab) return { ok: false, error: "No sender tab." };

  try {
    await api.tabs.update(tab, { url: href });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function dispatch(action: string, payload: Record<string, unknown> = {}) {
  const [page] = await api.tabs.query({ active: true, currentWindow: true });
  if (!page?.id) return { ok: false, error: "No active tab." };

  try {
    return await api.tabs.sendMessage(page.id, { ...payload, target: "markity", action });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function local(href: string) {
  const url = new URL(href);
  return url.protocol === "file:" && markdown.test(url.pathname);
}
