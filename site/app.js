const toggle = document.querySelector(".theme-toggle");
const label = toggle.querySelector(".theme-toggle-label");
const modes = ["system", "light", "dark"];
const names = { system: "System", light: "Light", dark: "Dark" };

let theme = localStorage.markityTheme ?? "system";
apply();

toggle.addEventListener("click", () => {
  theme = modes[(modes.indexOf(theme) + 1) % modes.length];
  localStorage.markityTheme = theme;
  apply();
});

function apply() {
  document.documentElement.dataset.theme = theme;
  label.textContent = names[theme];
}

document.querySelector("#year").textContent = new Date().getFullYear();
