import type { SceneNavigationOptions } from "../transition/types";

export const gameRoutes = ["title", "prologue", "menu", "mansion", "shop", "dice", "battle", "map", "character-status", "settings"] as const;
export type GameRoute = typeof gameRoutes[number];
export type RouteLocation = { page: GameRoute; search: string };
export function routeHref(page: GameRoute, search = "") { return `#/${page}${search}`; }

/** Hash routes also work on static hosts and under any deployment subdirectory. */
export function readRoute(url = new URL(window.location.href)): RouteLocation | null {
  const hash = /^#\/([^?]+)(\?.*)?$/.exec(url.hash);
  if (hash) return gameRoutes.includes(hash[1] as GameRoute) ? {page: hash[1] as GameRoute, search: hash[2] ?? ""} : null;
  const legacy = /\/([^/]+)\.html$/.exec(url.pathname)?.[1];
  if (legacy && gameRoutes.includes(legacy as GameRoute)) return {page: legacy as GameRoute, search: url.search};
  if (!url.hash && (!legacy || legacy === "index")) return {page: "title", search: url.search};
  return null;
}
export function routeSearch() { return readRoute()?.search ?? window.location.search; }
export function isGameTarget(url: URL) {
  if (url.origin !== window.location.origin || !readRoute(url)) return false;
  // Only this installation's shell/legacy entry points; never capture external pages or SVG anchors.
  const base = new URL("./", window.location.href).pathname;
  const file = url.pathname.slice(base.length);
  return url.pathname.startsWith(base) && (file === "" || file === "index.html" || gameRoutes.some(page => file === `${page}.html`));
}
type Navigator = (target: string, options?: SceneNavigationOptions) => boolean;
let navigator: Navigator | undefined;
export function bindNavigator(next: Navigator) { navigator = next; return () => { if (navigator === next) navigator = undefined; }; }
export function navigateTo(target: string, options?: SceneNavigationOptions) {
  if (navigator) return navigator(target, options);
  if (options?.replace) window.location.replace(target); else window.location.assign(target);
  return true;
}
