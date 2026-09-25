import type { ValidatedD5Catalog } from "../game-core/contracts/d5";
import type { D5Projection } from "../game-core/session/d5-types";
import { equipmentTargets } from "../game-core/contracts/equipment";
import { resolveDemoCharacter } from "../game-core/battle/rules/v2/configuration";

/** The preview uses the same native selectors and resolver as the battle engine. */
export function equipmentPreview(catalog: ValidatedD5Catalog, campaign: D5Projection, definitionId: string) {
  const definition = catalog.data.equipment[definitionId];
  return campaign.availableCharacterIds.flatMap(ownerId => {
    const targets = equipmentTargets(catalog.data, ownerId, definition);
    if (!targets.length) return [];
    const progress = {...campaign.progress, equipment: campaign.progress.equipment.filter(e => e.ownerId !== ownerId)};
    const before = resolveDemoCharacter(catalog.data, progress, ownerId).faces;
    return [{ownerId, name: catalog.data.characters[ownerId].name,
      options: (definition.scope === "native-face" ? targets.map(f => f.id) : [null]).map(targetFaceId => {
        const after = resolveDemoCharacter(catalog.data, {...progress, equipment: [...progress.equipment,
          {instanceId: "equipment:preview", definitionId, ownerId, ...(targetFaceId ? {targetFaceId} : {})}]}, ownerId).faces;
        return {targetFaceId, faces: after.map((face, i) => ({...face,
          action: catalog.data.actions[face.actionId].kind,
          beforeAction: catalog.data.actions[before[i].actionId].kind, beforePower: before[i].power,
          changed: face.actionId !== before[i].actionId || face.power !== before[i].power}))};
      })}];
  });
}
export type EquipmentPreview = ReturnType<typeof equipmentPreview>;
