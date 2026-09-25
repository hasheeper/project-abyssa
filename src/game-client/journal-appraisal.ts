import { shopLootPresentation } from "../content/presentation/shop-loot";
import unknownIcon from "../assets/icons/items/locked-chest.svg";
import { resolveItemIcon } from "../assets/icons/items/catalog";
import type { PublicAppraisal } from "../game-core/contracts";

export type JournalAppraisalItem = {
  id: string;
  name: string;
  icon: string;
  appearance: string;
  quantity: number;
};

/** A reading projection only: owned lots remain separate for appraisal and sale. */
export function pendingAppraisalGroups(loot: readonly {instanceId?: string; definitionId: string; resultId: string | null}[],
  generated: Readonly<Record<string, Pick<PublicAppraisal, "unknownName" | "appearance">>> = {}): JournalAppraisalItem[] {
  const groups = new Map<string, JournalAppraisalItem>();
  for (const item of loot) {
    if (item.resultId) continue;
    const copy = item.instanceId && generated[item.instanceId];
    if (item.instanceId && copy) {
      groups.set(item.instanceId, {id: item.instanceId, name: copy.unknownName, appearance: copy.appearance,
        icon: resolveItemIcon(copy.unknownName).assetUrl, quantity: 1});
      continue;
    }
    const presentation = shopLootPresentation[item.definitionId];
    const existing = groups.get(item.definitionId);
    const quantity = presentation?.quantity ?? 1;
    if (existing) existing.quantity += quantity;
    else groups.set(item.definitionId, {
      id: item.definitionId,
      name: presentation?.unknownName ?? "未鉴定物品",
      icon: presentation?.unknownIconUrl ?? presentation?.iconUrl ?? unknownIcon,
      appearance: presentation?.appearance ?? "",
      quantity,
    });
  }
  return [...groups.values()];
}
