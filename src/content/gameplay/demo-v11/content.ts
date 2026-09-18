import type { D5Catalog } from "../../../game-core/contracts";
import { AIRP_POOL_CATALOG_DATA } from "../demo-v9/content";
import { TIDE_GUIDE } from "./guide";

const previous = structuredClone(AIRP_POOL_CATALOG_DATA);
/** G2 rules release; G3 connects the original UI and makes it the new-game default. */
export const GUIDED_TIDE_CATALOG_DATA: D5Catalog = {
  ...previous, contentVersion: 11,
  tutorial: {...previous.tutorial!, guide: TIDE_GUIDE},
  routes: {...previous.routes, "intro.tide-cave.first": {id: "intro.tide-cave.first", layers: [TIDE_GUIDE.nodes.map(n => n.roomId)]}},
  journey: {...previous.journey!,
    rooms: {...previous.journey!.rooms, "room.tide-cave.event.intro": {id: "room.tide-cave.event.intro", kind: "event", eventId: "event.tide-cave.cache", sceneId: "scene.tide-cave.shore"}},
    events: {...previous.journey!.events, "event.tide-cave.cache": {id: "event.tide-cave.cache", kind: "relic", name: "潮坑落货", text: "石缝里卡着一只浸过海水的硬皮包。选择一名队员，小心检查里面的物件。", cost: 0, reward: 0}},
  },
};
