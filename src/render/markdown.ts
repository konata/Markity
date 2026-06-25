import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";
import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import checkbox from "./assets/checkbox.svg?raw";
import checkedbox from "./assets/checkbox-done.svg?raw";

const markdown = new MarkdownIt({
  breaks: false,
  html: true,
  linkify: true,
  typographer: true
});

markdown.use(tasks).use(marks);

const escape = markdown.utils.escapeHtml;
const render = markdown.renderer.rules;

render.code_inline = (tokens, index) => `<code class='code-inline'>${escape(tokens[index].content)}</code>`;

render.code_block = (tokens, index) =>
  `<pre class='indented-code'><code>${escape(tokens[index].content)}</code></pre>\n`;

render.fence = (tokens, index) => {
  const token = tokens[index];
  const language = token.info.trim().split(/\s+/)[0];
  const code = highlight(token.content, language);
  const syntax = language ? ` data-language="${escape(language)}"` : "";
  return `<pre class='fenced-code'><code class='fenced-code-content'${syntax}>${code}</code></pre>\n`;
};

render.heading_open = (tokens, index) => {
  const token = tokens[index];
  const text = textContent(tokens[index + 1]);
  token.attrSet("id", text);
  return markdown.renderer.renderToken(tokens, index, {});
};

render.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = token.attrGet("href");
  if (href?.startsWith("http://") || href?.startsWith("https://")) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noreferrer");
  }
  return self.renderToken(tokens, index, options);
};

render.mark_open = () => "<mark>";
render.mark_close = () => "</mark>";

for (const block of [
  "blockquote_close",
  "bullet_list_close",
  "heading_close",
  "hr",
  "ordered_list_close",
  "paragraph_close"
] as const) {
  const base = render[block];
  render[block] = (tokens, index, options, env, self) => {
    const html = base?.(tokens, index, options, env, self) ?? self.renderToken(tokens, index, options);
    return tokens[index].level === 0 && follows(tokens, index) ? `${html}<br>\n` : html;
  };
}

export function body(markdownSource: string) {
  return DOMPurify.sanitize(callouts(markdown.render(markdownSource)), {
    ADD_ATTR: ["target", "role", "aria-checked", "data-language", "data-alignment", "viewBox", "fill-rule", "stroke-width", "rx", "d", "opacity"],
    ADD_TAGS: ["svg", "g", "rect", "path"],
    USE_PROFILES: { html: true, svg: true }
  });
}

export function title(markdownSource: string, fallback = "Markdown") {
  if (fallback !== "Markdown") return fallback;
  return (
    markdownSource
      .split(/\r?\n/)
      .map(line => /^#\s+(.+)$/.exec(line)?.[1]?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim())
      .find(Boolean) ?? fallback
  );
}

function highlight(code: string, language: string) {
  if (!language || !hljs.getLanguage(language)) return escape(code);
  try {
    return hljs.highlight(code, { language, ignoreIllegals: true }).value;
  } catch {
    return escape(code);
  }
}

function textContent(token: Token | undefined) {
  return token?.children?.map(child => (child.type === "text" || child.type === "code_inline" ? child.content : "")).join("") ?? token?.content ?? "";
}

function follows(tokens: Token[], index: number) {
  return tokens.slice(index + 1).some(token => token.level === 0 && !token.hidden);
}

function tasks(md: MarkdownIt) {
  md.core.ruler.after("inline", "markity_tasks", state => {
    const tokens = state.tokens;
    for (let index = 0; index < tokens.length; index++) {
      const item = tokens[index];
      const inline = tokens[index + 2];
      if (item.type !== "list_item_open" || inline?.type !== "inline") continue;

      const match = /^\[( |x|X)\]\s+/.exec(inline.content);
      if (!match) continue;

      const checked = match[1].toLowerCase() === "x";
      item.attrJoin("class", "task-list-item");
      item.attrSet("role", "checkbox");
      item.attrSet("aria-checked", String(checked));
      tokens.slice(0, index).reverse().find(token => token.level === item.level - 1 && /^(bullet|ordered)_list_open$/.test(token.type))?.attrJoin("class", "todo-list");

      inline.content = inline.content.slice(match[0].length);
      const first = inline.children?.find(child => child.type === "text" && child.content.startsWith(match[0]));
      if (first) first.content = first.content.slice(match[0].length);

      const box = new state.Token("html_inline", "", 0);
      box.content = `<span class="todo-checkbox${checked ? " todo-checked" : ""}">${checked ? checkedbox : checkbox}</span>`;
      inline.children?.unshift(box);
    }
  });
}

function marks(md: MarkdownIt) {
  md.inline.ruler.before("emphasis", "markity_mark", (state, silent) => {
    if (state.src.slice(state.pos, state.pos + 2) !== "==") return false;
    const end = state.src.indexOf("==", state.pos + 2);
    if (end < 0) return false;
    if (silent) return true;

    state.push("mark_open", "mark", 1).markup = "==";
    state.md.inline.parse(state.src.slice(state.pos + 2, end), state.md, state.env, state.tokens);
    state.push("mark_close", "mark", -1).markup = "==";
    state.pos = end + 2;
    return true;
  });
}

function callouts(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const quote of [...template.content.querySelectorAll("blockquote")]) {
    const first = quote.firstElementChild;
    if (!(first instanceof HTMLElement) || first.tagName !== "P") continue;

    const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.innerHTML);
    if (!match) continue;

    const kind = match[1].toLowerCase();
    const rest = first.innerHTML.slice(match[0].length);
    const [head, ...tail] = rest.split(/<br\s*\/?>/i);
    const title = document.createElement("div");
    title.className = "md-callout-head";
    title.innerHTML = head.trim() || kind.toUpperCase();

    quote.classList.add("md-callout", `md-callout-${kind}`);
    quote.insertBefore(title, first);

    if (tail.length) first.innerHTML = tail.join("<br>");
    else first.remove();
  }

  return template.innerHTML;
}
