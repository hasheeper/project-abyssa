import type { RuleCatalog } from "../game-core/battle/domain/rule-state";

export type JourneyRoute = {
  routeId: string; nodeId: string; name: string; englishName: string;
  skin: "old-manor" | "timber" | "hero-party"; ending: "plain" | "manor";
  layerCount: number; exitLayers: number[]; lastSceneId: string; depthFactors: number[]; layerSceneIds: string[];
  brief: {flavor: string; threats: string[]; event: string};
};

/** Only published ordinary routes appear here; tutorial and memory stay separate. */
export function journeyRoutes(catalog: RuleCatalog): Record<string, JourneyRoute> {
  const routes: Record<string, JourneyRoute> = {};
  const make = (routeId: string, entry: Omit<JourneyRoute, "routeId" | "layerCount" | "exitLayers" | "lastSceneId" | "depthFactors" | "layerSceneIds">) => {
    const route = catalog.routes[routeId];
    const exitLayers = route.layers.flatMap((rooms, i) => rooms.some(id => catalog.journey!.rooms[id].kind === "exit") ? [i + 1] : []);
    routes[routeId] = {...entry, routeId, layerCount: route.layers.length, exitLayers,
      depthFactors: catalog.journey!.depthPercent.slice(0, route.layers.length).map(n => n / 100),
      layerSceneIds: route.layers.map(rooms => catalog.journey!.rooms[rooms.at(-1)!].sceneId),
      lastSceneId: catalog.journey!.rooms[route.layers.at(-1)!.at(-1)!].sceneId};
  };
  const manor = catalog.manor;
  for (const routeId of manor ? [manor.firstClearRouteId, manor.maintenanceRouteId] : catalog.journey ? [catalog.journey.defaultRouteId] : []) {
    const maintenance = routeId === manor?.maintenanceRouteId;
    make(routeId, {nodeId: "tower", name: "克雷格旧庄园", englishName: "The Old Manor", skin: "old-manor", ending: "manor",
      brief: {flavor: maintenance ? "主位已经收起。清理失去中央权限的支线残余，让旧庄园重新安静。" : "从迎客门厅走到宴会厅，逐区拆开红线，结束等候三百年的家宴。",
        threats: ["举盘蓄力，缝补修复", maintenance ? "清理五层支线残余，不再重开家宴" : manor ? "三层管家考核，五层千金的举杯随宾客增减" : "落幕管家封锁下一回合命数骰"],
        event: manor ? "全程五层，第三层可撤离或深入；后半段通向第五层终场。" : "三层庄园考核，各层独立入袋；通过落幕管家后带宝返回。"}});
  }
  if (catalog.rulesVersion === 4) for (const d of Object.values(catalog.expeditions ?? {})) {
    make(d.id, {nodeId: d.nodeId, name: d.name, englishName: d.englishName, skin: d.skin, ending: d.ending,
      brief: {...d.brief, event: ""}});
    const r = routes[d.id];
    r.brief.event = `全程 ${r.layerCount} 层，第 ${r.exitLayers.join("、")} 层可撤离；清层后资金与战利品一同入袋。`;
  }
  return routes;
}
