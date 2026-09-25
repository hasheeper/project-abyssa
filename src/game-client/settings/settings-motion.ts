import { motionTokens } from "../../shared/ui/motion/presets";
import { panelRamp, paintSystemItem, prepareSystemItem, systemControlItems } from "../system-panel-motion";

export const settingsTiming = motionTokens.settingsPanel;
export type SettingsPart = "surface" | "heading" | "body" | "chrome";
/** A continuous reveal clock, so exit and interruptions retrace the same path. */
export function settingsSceneVisibility(reveal: number, part: SettingsPart, order = 0) {
  const ms = reveal * settingsTiming.enterMs;
  if (part === "surface") return panelRamp(ms, 0, settingsTiming.surfaceMs);
  if (part === "heading") return panelRamp(ms, 40 + order * 50, 240);
  if (part === "chrome") return panelRamp(ms, settingsTiming.chromeStartMs + order * settingsTiming.chromeStaggerMs, settingsTiming.chromeMs);
  return panelRamp(ms, settingsTiming.bodyStartMs + order * settingsTiming.bodyStaggerMs, settingsTiming.bodyMs);
}
export function settingsTabVisibility(reveal: number, part: SettingsPart, order = 0) {
  if (part === "surface" || part === "chrome") return 1;
  return panelRamp(reveal * settingsTiming.tabEnterMs, part === "heading" ? 0 : 40 + order * 32, part === "heading" ? 180 : 220);
}

export function bindSettingsMotion(root: HTMLElement) {
  const items: { element: HTMLElement; part: SettingsPart; order: number }[] = [];
  const add = (selector: string, part: SettingsPart, order?: number) => {
    root.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
      prepareSystemItem(root, element); items.push({ element, part, order: order ?? index });
    });
  };
  // The full-scene bilingual title belongs to the host, never to a category swap.
  add(".abyssa-system-panel__heading > :not(.system-scene__heading), .settings-section-heading > *", "heading");
  add(".settings-list > .settings-row", "body");
  add(".settings-crop", "body", 1);
  add(".settings-preview", "body", 4);
  add(".settings-side > .settings-side__label", "body", 0);
  add(".settings-load > li", "body");
  add(".settings-side > .settings-status", "body", 1);
  add(".settings-side > .settings-slot", "body", 2);
  add(".settings-side > .settings-note", "body", 3);
  add(".airp-settings-main > .airp-settings-heading", "body", 0);
  add(".airp-connection-shared", "body", 1);
  add(".airp-settings-main .airp-model", "body");
  add(".airp-settings-preset", "body", 1);
  add(".airp-settings-session", "body", 3);
  for (const { element, order } of systemControlItems(root)) {
    prepareSystemItem(root, element); items.push({ element, part: "chrome", order });
  }
  return (reveal: number, tabReveal: number, skip: boolean) => {
    root.style.setProperty("--settings-surface-opacity", String(skip ? 1 : settingsSceneVisibility(reveal, "surface")));
    for (const { element, part, order } of items) {
      paintSystemItem(element, skip ? 1 : settingsSceneVisibility(reveal, part, order) * settingsTabVisibility(tabReveal, part, order));
    }
  };
}
