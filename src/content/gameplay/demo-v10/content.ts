import type { AirpScript, D5Catalog } from "../../../game-core/contracts";
import { AIRP_POOL_CATALOG_DATA } from "../demo-v9/content";

const id = "airp.online.case.followup", sectionId = `${id}.section`;
const followup: AirpScript = {
  schemaVersion: 1, id, title: "药箱归位之后", locale: "zh-CN",
  player: { actorId: "kael", nameToken: "{{user}}", authoredSpeech: false }, cast: ["kael", "elora"],
  presentation: { stagePreset: "mansion-morning", backgroundId: "mansion.first-morning", defaultMode: "adv", allowRp: false, initialSlots: { left: "elora" } },
  sections: [{ id: sectionId, title: "药箱归位之后" }],
  nodes: [
    { id: `${id}.0`, cursor: 0, sectionId, kind: "beat", frames: [{ id: `${id}.0`, kind: "narration", text: "艾洛拉把药箱向桌里侧挪了一点，给茶杯让出位置。" }] },
    { id: `${id}.1`, cursor: 1, sectionId, kind: "beat", frames: [{ id: `${id}.1`, kind: "dialogue", actorId: "elora", emotion: "smile", text: "箱子已经放好了。您也坐一会儿吧，别又站在门口。" }] },
  ],
};
/** Opt-in online application version. Content 8/9 remain byte-for-byte authored catalogs. */
export const AIRP_ONLINE_CATALOG_DATA: D5Catalog = {
  ...structuredClone(AIRP_POOL_CATALOG_DATA), contentVersion: 10,
  airpOnline: { version: 1, definitionId: "ripple.elora.old-medicine-case", followup },
};
