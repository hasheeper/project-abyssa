import type { DirectorCapabilities, DirectorCard, DirectorFixedCard } from "../../../game-core/contracts";
import { AIRP_POOL_CONTENT } from "../airp-v2/content";
import { DIRECTOR_LOCATIONS } from "./locations";

const ids = ["ripple.elora.old-medicine-case", "ripple.elora.watch-note", "ripple.kororo.quiet-cup"];
const sourceDigests: Record<string, string> = {
  "ripple.elora.old-medicine-case": "0c370264161379d3e75eb3b4d831204be643d73f0dfbf8a08beb6e7b48c02f3a",
  "ripple.elora.watch-note": "095b77edc3f9672796fdab60ca13f63bfd7613e3d42036477081a48674285c97",
  "ripple.kororo.quiet-cup": "f33de54a731802744ef792fab08dc3b378d8bb410c4bbd9be31c4e4023328558",
};
const originals = ids.map(id => {
  const card = AIRP_POOL_CONTENT.cards.find(c => c.id === id);
  if (!card) throw Error(`Missing director working draft: ${id}`);
  return card;
});
export const DIRECTOR_CAPABILITIES: DirectorCapabilities = {
  actorIds: Object.keys(DIRECTOR_LOCATIONS),
  locationIds: [...new Set(Object.values(DIRECTOR_LOCATIONS).flatMap(s => Object.values(s).filter((x): x is string => x !== null)))],
  locations: DIRECTOR_LOCATIONS,
  objectIds: originals.filter(c => c.objective.form === "sortie").map(c => c.id),
  objectives: Object.fromEntries(originals.flatMap(c => c.objective.form === "sortie" ? [[c.id, {
    routeId: c.objective.spec.objective.routeId, roomDefinitionId: c.objective.spec.objective.roomDefinitionId,
    layer: c.objective.spec.objective.layer, roomIndex: c.objective.spec.objective.roomIndex, objectIds: [c.id],
  }]] : [])),
};

/** No edits to the original card or script. These are opt-in engineering drafts, not new canon. */
export const DIRECTOR_FIXED_CARDS: DirectorFixedCard[] = originals.map(original => {
  const objective = original.objective, id = original.id;
  const choices = [{id: "participate", label: objective.form === "vignette" ? "坐一会儿" : "参与这件事", intent: "玩家明确参与；只确认当前承诺，不预定执行结果。"}];
  const card: DirectorCard = {
    version: 1, id, title: original.title, tier: "ripple", form: objective.form,
    giverId: original.giverId, actorIds: [...original.actorIds], locationId: "plaza",
    themeKey: original.themeKey, themeDescription: `作者工作稿：${original.title}；只承接此事，不改写目标。`,
    objectIds: objective.form === "sortie" ? [id] : [],
    synopsis: original.title, motivation: "以附带的原始作者工作稿为依据，按当前真实阶段提出事情。",
    load: objective.form === "vignette" ? "light" : "focus", volatility: original.volatility,
    offerPhases: original.volatility === "inert" ? 8 : 4, repeat: original.repeat, choices,
    actions: objective.form === "sortie" ? [{id: "patrol", kind: "patrol", objectiveId: id, actorId: original.giverId, locationId: "plaza", intent: "接受后进行真实巡守，依据实际目标证据和结算反馈；失败不冒称取回。", choices}]
      : objective.form === "liaison" ? [{id: "target", kind: "talk", actorId: objective.targetActorId, locationId: "plaza", intent: "携带前段已读原文和玩家实际选择，与指定目标交谈并取得答复；尚未返回委托人。", choices}]
      : [],
    scenes: {
      offer: "依据原工作稿提出当下的事情，停在玩家参与／推迟／拒绝之前。",
      acceptance: "只回应玩家刚才的实际选择，不替玩家提前完成后面的行动。",
      result: "承接本事件前序原文、实际行动与反馈，展示当前结果；不重新接任务。",
      declined: "承接玩家明确拒绝，结束这次提议，不制造惩罚或新的承诺。",
    },
    aftermath: original.aftermath ? {intent: original.aftermath, actorIds: [...original.actorIds]} : null,
  };
  return {card, authorStatus: "working-draft", sourceId: original.id, sourceDigest: sourceDigests[original.id]};
});

export function directorAuthorSource(id: string) {
  const card = originals.find(c => c.id === id);
  if (!card) throw Error("Unknown director author source");
  return structuredClone({card, scripts: Object.fromEntries(Object.values(card.scenes).map(key => [key, AIRP_POOL_CONTENT.scripts[key]]))});
}
