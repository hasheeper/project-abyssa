function selectWithin(container, button) {
  for (const item of container.querySelectorAll("button")) {
    item.removeAttribute("data-selected");
    item.setAttribute("aria-pressed", "false");
    if (item.getAttribute("role") === "tab") {
      item.setAttribute("aria-selected", "false");
    }
  }

  button.setAttribute("data-selected", "");
  button.setAttribute("aria-pressed", "true");
  if (button.getAttribute("role") === "tab") {
    button.setAttribute("aria-selected", "true");
  }

  if (container.classList.contains("panel-grid") || container.classList.contains("character-selector")) {
    container.querySelector(".abyssa-panel-tile__marker")?.remove();
    const marker = document.createElement("span");
    marker.className = "abyssa-panel-tile__marker";
    marker.setAttribute("aria-hidden", "true");
    button.append(marker);
  }

  if (container.classList.contains("abyssa-diamond-track")) {
    for (const item of container.querySelectorAll("button")) {
      item.setAttribute("data-variant", item === button ? "active" : item.dataset.previewVariant);
    }
  }
}

for (const tabList of document.querySelectorAll('[role="tablist"]')) {
  tabList.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab) selectWithin(tabList, tab);
  });
}

for (const group of document.querySelectorAll(
  ".panel-grid, .square-panel-grid, .character-selector, .abyssa-diamond-track"
)) {
  if (group.classList.contains("abyssa-diamond-track")) {
    for (const button of group.querySelectorAll("button")) {
      button.dataset.previewVariant = button.getAttribute("data-variant") === "teal" ? "teal" : "inactive";
    }
  }

  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) selectWithin(group, button);
  });
}

for (const toggle of document.querySelectorAll('[role="switch"]')) {
  toggle.addEventListener("click", () => {
    const checked = toggle.getAttribute("aria-checked") !== "true";
    toggle.setAttribute("aria-checked", String(checked));
    toggle.toggleAttribute("data-checked", checked);
    toggle.querySelector("span")?.replaceChildren(checked ? "On" : "Off");

    const output = toggle.parentElement?.querySelector("output");
    if (output) output.textContent = checked ? "ON" : "OFF";
  });
}
