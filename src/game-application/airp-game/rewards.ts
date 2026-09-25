import type { CommissionReward } from "../../game-core/contracts";
import type { ExpeditionJob } from "../airp-expedition-gm/contracts";

/** A frozen, validated GM plan is the sole source of executable quest placements. */
export function gameCommissionRewards(job: ExpeditionJob | undefined): CommissionReward[] | undefined {
  const input = job?.frames.at(-1)?.context.rules, plan = job?.prepared;
  if (input?.commissionRewardVersion !== 1 || !plan) return undefined;
  return input.commissions.map(c => {
    const item = plan.itemDefinitions.find(d => d.templateId === c.itemTemplateId);
    const slot = input.slots.find(s => s.id === c.slotId);
    if (!item || !slot || !["room-cleared", "layer-banked"].includes(item.fields.awardWhen)) throw Error("委托缺少可执行的物品奖励安排。");
    return {definitionId: item.id, eventId: c.eventId, stepId: c.stepId, objectiveId: c.objectiveId,
      label: item.fields.label, description: item.fields.description, layer: slot.layer, roomIndex: slot.roomIndex,
      roomDefinitionId: slot.roomDefinitionId, awardWhen: item.fields.awardWhen as CommissionReward["awardWhen"]};
  });
}
