import type { DemoContent, DemoEquipment, DemoEquipmentDef } from "./demo";
import * as v from "./validation";

/** Only the new catalog reader permits native-face definitions. Legacy catalogs
 * therefore keep their original two-item allocation and strict field shape. */
export const expandedEquipment = (content: DemoContent) => Object.values(content.equipment).some(e => e.scope === "native-face");
export const equipmentLimit = (content: DemoContent) => expandedEquipment(content) ? Object.keys(content.characters).length : 2;

export function equipmentTargets(content: DemoContent, ownerId: string, definition: DemoEquipmentDef) {
  const owner = v.reference(content.characters, ownerId, "ownerId");
  if (owner.release) return [];
  const kind = definition.scope === "all-native-blanks" ? "blank" : definition.nativeAction;
  return owner.faces.filter(face => content.actions[face.actionId].kind === kind);
}

export function validateEquipmentDefinition(raw: unknown, id: string, expanded: boolean) {
  const initial = v.record(raw, id);
  const scoped = expanded && initial.scope === "native-face";
  const def = v.record(raw, id, ["id", "slot", "scope", "replacement", "power", ...(scoped ? ["nativeAction", "operation"] : [])]);
  if (def.id !== id || !id.startsWith("equipment.")) v.invalid(id, "Invalid equipment identity");
  if (!expanded) v.choice(id, ["equipment.spare-blade", "equipment.emergency-pouch"], id);
  v.choice(def.slot, ["general"], id);
  v.choice(def.scope, scoped ? ["native-face"] : ["all-native-blanks"], id);
  v.choice(def.replacement, expanded ? ["attack", "heal", "guard"] : ["attack", "heal"], id);
  v.choice(def.power, scoped ? [1, 2] : [1], id);
  if (scoped) {
    v.choice(def.nativeAction, ["attack", "guard", "heal", "blank"], id);
    v.choice(def.operation, ["replace", "boost"], id);
    if (def.operation === "boost" && (def.nativeAction !== def.replacement || def.nativeAction === "blank" || def.power !== 1)) v.invalid(id, "Boost must add one to one ordinary action");
  }
  return def as DemoEquipmentDef;
}

export function validateEquipmentAllocation(content: DemoContent, raw: unknown): DemoEquipment {
  const row = v.record(raw, "equipment");
  const definitionId = v.id(row.definitionId, "definitionId"), def = v.reference(content.equipment, definitionId, "definitionId");
  v.record(row, "equipment", ["instanceId", "definitionId", "ownerId", ...(def.scope === "native-face" ? ["targetFaceId"] : [])]);
  const ownerId = v.id(row.ownerId, "ownerId"), instanceId = v.id(row.instanceId, "instanceId");
  const faces = equipmentTargets(content, ownerId, def);
  if (!faces.length) v.invalid("equipment", "No applicable native face", "equipment-inapplicable");
  if (def.scope === "native-face") {
    const targetFaceId = v.id(row.targetFaceId, "targetFaceId");
    if (!faces.some(face => face.id === targetFaceId)) v.invalid("targetFaceId", "Target is not a matching native face", "equipment-inapplicable");
    return {instanceId, definitionId, ownerId, targetFaceId};
  }
  return {instanceId, definitionId, ownerId};
}
