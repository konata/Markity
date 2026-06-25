import baseSource from "./assets/base.css?raw";
import darkSource from "./assets/dark.json?raw";
import lightSource from "./assets/light.json?raw";
import patchSource from "./assets/patch.css?raw";
import variableSource from "./assets/variables.css?raw";

export type ThemeMode = "system" | "light" | "dark";

type Bag = Record<string, unknown>;

const syntax = ["comment", "constant", "number", "string", "entity", "keyword", "function", "variable"];
const highlighters = ["red", "blue", "green", "purple", "yellow"];
const paths = {
  text_color: "editor.text color",
  text_secondary_color: "base.text secondary color",
  text_tertiary_color: "base.text tertiary color",
  background_color: "base.background color",
  background_secondary_color: "base.background secondary color",
  background_tertiary_color: "base.background tertiary color",
  stroke_color: "base.stroke color",
  accent_color: "base.accent color",
  highlight_color: "base.highlight color",
  selection_color: "base.selection color",
  text_size: "editor.text size",
  line_height_multiplier: "editor.line height multiplier",
  headers_modular_scale: "editor.headers.modular scale",
  headers_line_height_multiplier: "editor.headers.line height multiplier",
  headers_add_top_bottom_padding: "editor.headers.add top bottom padding",
  headers_padding_top_multiplier: "editor.headers.padding top multiplier",
  headers_padding_bottom_multiplier: "editor.headers.padding bottom multiplier",
  code_text_size_multiplier: "editor.code.text size multiplier",
  ...Object.fromEntries(syntax.map(name => [`code_${name}_color`, `editor.code.syntax highlight.${name}`] as const)),
  ...Object.fromEntries(highlighters.flatMap(name => [
    [`editor_highlighter_${name}_background_color`, `editor.highlighter.${name}.background color`] as const,
    [`editor_highlighter_${name}_text_color`, `editor.highlighter.${name}.text color`] as const
  ]))
};

const themes = {
  light: JSON.parse(lightSource) as Bag,
  dark: JSON.parse(darkSource) as Bag
};

export function active(mode: ThemeMode) {
  if (mode !== "system") return mode;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function stylesheet(mode: ThemeMode = "system") {
  const selected = active(mode);
  const theme = themes[selected];
  const values = Object.fromEntries(
    Object.entries(paths).map(([name, path]) => [name, resolve(theme, value(theme, path))])
  );
  if (selected === "light") {
    values.highlight_color = "";
    values.headers_line_height_multiplier = 1.3;
  }
  return `${fill(variableSource, values)}
${baseSource}
${fill(patchSource, values)}`;
}

function value(theme: Bag, path: string) {
  return path.split(".").reduce<unknown>((node, part) => (node as Bag | undefined)?.[part], theme);
}

function resolve(theme: Bag, raw: unknown): string | number {
  if (typeof raw !== "string") return raw as string | number;
  if (!raw.startsWith("$")) return raw;
  return resolve(theme, value(theme, raw.slice(1)));
}

function fill(source: string, values: Record<string, string | number>) {
  return source.replace(/\{\{\{?\s*([\w_]+)\s*\}?\}\}/g, (_, name: string) => String(values[name] ?? ""));
}
