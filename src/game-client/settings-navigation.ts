import { routeHref, routeSearch } from "../shared/routing/location";
import { gameHref, parseLocator } from "./navigation";

/** No history.back() or arbitrary return URL: direct links are safe too. */
export function settingsReturnHref(search = routeSearch()) {
  const params = new URLSearchParams(search), locator = parseLocator(search);
  return params.get("from") === "menu" && locator ? gameHref("menu", locator) : routeHref("title");
}
