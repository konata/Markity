const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const label = toggle?.querySelector(".theme-toggle-label");
const order = ["system", "light", "dark"];
const name = { system: "System", light: "Light", dark: "Dark" };

let theme = localStorage.markityTheme ?? "system";
apply(theme);

toggle?.addEventListener("click", () => {
  theme = order[(order.indexOf(theme) + 1) % order.length];
  localStorage.markityTheme = theme;
  apply(theme);
});

function apply(mode) {
  root.dataset.theme = mode;
  if (label) label.textContent = name[mode];
}

const year = document.querySelector("#year");
if (year) year.textContent = String(new Date().getFullYear());
