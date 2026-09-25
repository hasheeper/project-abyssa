import { directorTestContext, directorTestMaterial } from "./airp-director-fixture";
import { compileDirectorInput } from "../airp-director/compile";
import { parseDirectorReview, type DirectorPlanProposal } from "../../game-core/contracts";
import { directorHash } from "../../game-core/session";

/** Controlled semantic cases, not fabricated gameplay or publication evidence. */
export function directorSemanticCases() {
  const context = directorTestContext(), material = directorTestMaterial(), original = context.fixed[2].card;
  context.world.themes = [{sourceId: "past-tea", key: "tea-pause", description: "柯萝萝请玩家坐下，喝一杯热饮，歇一会儿，没有委托或后续承诺。", objectIds: [], untilPhase: 256}];
  return ["same", "new"].map(expected => {
    const card = structuredClone(original);
    card.id = `candidate-${expected}`; card.themeKey = `renamed-${expected}`;
    card.title = expected === "same" ? "柯萝萝：在窗边暖暖手" : "柯萝萝：辨认两张错装的星图";
    card.themeDescription = expected === "same" ? "换个地方坐下，柯萝萝递热茶，和玩家一起歇一会儿。没有新任务。" : "发现两张装反的星图，柯萝萝请玩家当场分清它们的标记并换回，和饮茶、休息无关。";
    card.synopsis = card.themeDescription; card.motivation = card.themeDescription;
    if (expected === "new") {card.form = "household"; card.load = "focus"; card.actions = [{id: "sort", kind: "do", actorId: "kororo", locationId: "plaza", intent: "依照星图背面的标记换回位置", choices: card.choices}];}
    const proposal: DirectorPlanProposal = {version: 1, day: 1, reason: "受控语义验收样本，非真实游玩", focus: expected === "new" ? {kind: "new", id: expected} : null,
      entries: [{id: expected, fromPhase: 2, throughPhase: 2, basisIds: ["fact:1"], source: {kind: "free", card}}]};
    return {expected, planHash: directorHash(proposal), input: compileDirectorInput(material, context, proposal)};
  });
}
export {parseDirectorReview};
