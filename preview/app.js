function setSelectedState(button, selected, options = {}) {
  button.toggleAttribute("data-selected", selected);

  if (button.hasAttribute("aria-pressed")) {
    button.setAttribute("aria-pressed", String(selected));
  }
  if (button.getAttribute("role") === "tab") {
    button.setAttribute("aria-selected", String(selected));
  }
  if (options.current) {
    if (selected) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
}

function getEnabledButtons(container, selector) {
  return Array.from(container.querySelectorAll(selector)).filter(
    (button) => !button.disabled
  );
}

function getAdjacentButton(buttons, current, offset) {
  if (buttons.length === 0) return undefined;
  const currentIndex = Math.max(0, buttons.indexOf(current));
  return buttons[(currentIndex + offset + buttons.length) % buttons.length];
}

function centerWithinScroller(scroller, item, behavior = "smooth") {
  if (!scroller || !item) return;
  const scrollerRect = scroller.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  const itemCenter =
    itemRect.left -
    scrollerRect.left +
    scroller.scrollLeft +
    itemRect.width / 2;
  const left = itemCenter - scroller.clientWidth / 2;

  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({ left, behavior });
  } else {
    scroller.scrollLeft = left;
  }
}

function selectWithin(container, button) {
  for (const item of container.querySelectorAll("button")) {
    setSelectedState(item, item === button);
  }

  if (
    container.classList.contains("panel-grid") ||
    container.classList.contains("character-selector")
  ) {
    container.querySelector(".abyssa-panel-tile__marker")?.remove();
    const marker = document.createElement("span");
    marker.className = "abyssa-panel-tile__marker";
    marker.setAttribute("aria-hidden", "true");
    button.append(marker);
  }
}

for (const tabList of document.querySelectorAll('[role="tablist"]')) {
  const tabs = Array.from(tabList.children).filter(
    (child) => child.getAttribute("role") === "tab" && !child.disabled
  );
  const internalTabs = tabList.classList.contains("abyssa-character-screen__tabs");

  const selectTab = (tab, focus = false) => {
    for (const item of tabs) {
      const selected = item === tab;
      setSelectedState(item, selected);
      item.tabIndex = selected ? 0 : -1;
      if (internalTabs) item.dataset.variant = selected ? "teal" : "dark";
    }

    const panelId = tab.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.setAttribute("aria-labelledby", tab.id);

    if (focus) tab.focus();
    centerWithinScroller(tabList, tab);
  };

  const initialTab = tabs.find(
    (tab) => tab.getAttribute("aria-selected") === "true"
  ) ?? tabs[0];
  if (initialTab) selectTab(initialTab);

  tabList.addEventListener("click", (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (tab && tabList.contains(tab) && !tab.disabled) selectTab(tab);
  });

  tabList.addEventListener("keydown", (event) => {
    const current = event.target.closest('[role="tab"]');
    if (!current || !tabs.includes(current)) return;

    let next;
    if (event.key === "ArrowLeft") next = getAdjacentButton(tabs, current, -1);
    if (event.key === "ArrowRight") next = getAdjacentButton(tabs, current, 1);
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;

    event.preventDefault();
    selectTab(next, true);
  });
}

for (const group of document.querySelectorAll(
  ".panel-grid, .square-panel-grid, .character-selector"
)) {
  group.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button && group.contains(button) && !button.disabled) {
      selectWithin(group, button);
    }
  });
}

function updateOutfitPortrait(track, button) {
  if (!track.classList.contains("abyssa-character-screen__outfit-selector")) return;

  let outfits = [];
  try {
    outfits = JSON.parse(track.dataset.outfits ?? "[]");
  } catch {
    return;
  }

  const outfit = outfits.find((item) => item.id === button.dataset.nodeId);
  const portrait = track
    .closest(".abyssa-character-screen")
    ?.querySelector(".abyssa-character-screen__portrait img");
  if (!outfit?.portraitUrl || !portrait) return;

  portrait.src = outfit.portraitUrl;
  portrait.alt = outfit.portraitAlt ?? button.getAttribute("aria-label") ?? "";
}

for (const track of document.querySelectorAll(".abyssa-diamond-track")) {
  const buttons = getEnabledButtons(track, ".abyssa-diamond-node");
  const selectedVariant = track.dataset.selectedVariant ?? "active";

  const selectNode = (button, focus = false) => {
    for (const item of buttons) {
      const selected = item === button;
      setSelectedState(item, selected, { current: true });
      item.dataset.variant = selected
        ? selectedVariant
        : (item.dataset.baseVariant ?? "inactive");
      item.tabIndex = selected ? 0 : -1;
    }

    updateOutfitPortrait(track, button);
    if (focus) button.focus();
  };

  const initialNode = buttons.find((button) => button.hasAttribute("data-selected")) ?? buttons[0];
  if (initialNode) selectNode(initialNode);

  track.addEventListener("click", (event) => {
    const button = event.target.closest(".abyssa-diamond-node");
    if (button && track.contains(button) && !button.disabled) selectNode(button);
  });

  track.addEventListener("keydown", (event) => {
    const current = event.target.closest(".abyssa-diamond-node");
    if (!current || !buttons.includes(current)) return;

    const vertical = track.dataset.orientation === "vertical";
    let next;
    if (event.key === (vertical ? "ArrowUp" : "ArrowLeft")) {
      next = getAdjacentButton(buttons, current, -1);
    }
    if (event.key === (vertical ? "ArrowDown" : "ArrowRight")) {
      next = getAdjacentButton(buttons, current, 1);
    }
    if (event.key === "Home") next = buttons[0];
    if (event.key === "End") next = buttons[buttons.length - 1];
    if (!next) return;

    event.preventDefault();
    selectNode(next, true);
  });
}

for (const selector of document.querySelectorAll(
  ".abyssa-character-portrait-selector"
)) {
  const viewport = selector.querySelector(
    ".abyssa-character-portrait-selector__viewport"
  );
  const items = getEnabledButtons(
    selector,
    ".abyssa-character-portrait-selector__item"
  );
  const selectCharacter = (item, focus = false) => {
    for (const button of items) {
      const selected = button === item;
      setSelectedState(button, selected, { current: true });
      button.dataset.variant = selected ? "teal" : "dark";
      button.tabIndex = selected ? 0 : -1;
    }

    centerWithinScroller(viewport, item);
    if (focus) item.focus();
  };

  const getSelected = () =>
    items.find((item) => item.hasAttribute("data-selected")) ?? items[0];
  const initialItem = getSelected();
  if (initialItem) selectCharacter(initialItem);

  selector.addEventListener("click", (event) => {
    const item = event.target.closest(
      ".abyssa-character-portrait-selector__item"
    );
    if (item && selector.contains(item) && !item.disabled) {
      selectCharacter(item);
      return;
    }

    const current = getSelected();
    if (!current) return;
    if (event.target.closest(".abyssa-character-portrait-selector__arrow--previous")) {
      selectCharacter(getAdjacentButton(items, current, -1));
    }
    if (event.target.closest(".abyssa-character-portrait-selector__arrow--next")) {
      selectCharacter(getAdjacentButton(items, current, 1));
    }
  });

  selector.addEventListener("keydown", (event) => {
    const current = getSelected();
    if (!current) return;

    let target;
    if (event.key === "ArrowLeft") target = getAdjacentButton(items, current, -1);
    if (event.key === "ArrowRight") target = getAdjacentButton(items, current, 1);
    if (event.key === "Home") target = items[0];
    if (event.key === "End") target = items[items.length - 1];
    if (!target) return;

    event.preventDefault();
    selectCharacter(target, true);
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
