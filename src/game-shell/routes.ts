import type { ComponentType } from "react";
import type { GameRoute } from "../shared/routing/location";
export type RouteModule = { default: ComponentType; prepare?: () => Promise<void> };
const loaders: Record<GameRoute, () => Promise<RouteModule>> = {
  title: () => import("../apps/title/route"),
  prologue: () => import("../apps/prologue/route"),
  menu: () => import("../apps/menu/route"),
  mansion: () => import("../apps/mansion/route"),
  shop: () => import("../apps/shop/route"),
  dice: () => import("../apps/dice/route"),
  battle: () => import("../apps/battle/route"),
  map: () => import("../apps/map/route"),
  "character-status": () => import("../apps/character-status/route"),
  settings: () => import("../apps/settings/route"),
};
export const routeTitles: Record<GameRoute, string> = {title:"伺候魔王也算拯救世界吗？",prologue:"序幕",menu:"守望者之崖",mansion:"守望者之崖洋馆",shop:"守望者杂货铺",dice:"骰局",battle:"远征",map:"远征地图","character-status":"角色档案",settings:"设置"};
const modules = new Map<GameRoute, Promise<RouteModule>>();
export function loadRoute(page: GameRoute) {
  let pending = modules.get(page);
  if (!pending) {
    pending = loaders[page]().then(async module => { await module.prepare?.(); return module; }).catch(error => {modules.delete(page); throw error;});
    modules.set(page, pending);
  }
  return pending;
}
