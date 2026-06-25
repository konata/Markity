import { body, title } from "./markdown";
import { stylesheet, type ThemeMode } from "./theme";

export function document(markdown: string, theme: ThemeMode = "system", fallback?: string) {
  return {
    title: title(markdown, fallback),
    css: stylesheet(theme),
    html: `<div class="document-wrapper">${body(markdown)}</div>`
  };
}
