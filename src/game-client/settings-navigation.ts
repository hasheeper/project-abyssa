import { routeHref, routeSearch } from "../shared/routing/location";
import { gameHref, parseLocator, type SaveLocator } from "./navigation";

export function settingsHref(from: "title" | "menu", locator?: SaveLocator) {
  const params = new URLSearchParams({ from });
  if (from === "menu" && locator) {
    params.set("save", locator.saveId);
    params.set("epoch", locator.epoch);
  }
  return routeHref("settings", `?${params}`);
}

/** No history.back() or arbitrary return URL: direct links are safe too. */
export function settingsReturnHref(search = routeSearch()) {
  const params = new URLSearchParams(search), locator = parseLocator(search);
  return params.get("from") === "menu" && locator ? gameHref("menu", locator) : routeHref("title");
}
