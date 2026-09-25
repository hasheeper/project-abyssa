import { expect, it } from "vitest";
import { SHOP_WAVE_CATALOG_DATA } from "../../content/gameplay/demo-v23/content";
import { ORDINARY_DROPS_CATALOG_DATA } from "../../content/gameplay/demo-v21/content";
import { validateD5Catalog } from "../contracts/d5-validation";
import { equipmentTargets } from "../contracts/equipment";
import { resolveDemoCharacter, validateDemoProgress } from "../battle/rules/v2/configuration";
import type { DemoEquipment } from "../contracts/demo";

const catalog = validateD5Catalog(SHOP_WAVE_CATALOG_DATA), c = catalog.data;
it("applies all nine definitions to native faces, preserves fate and never stacks on re-resolution", () => {
  expect(Object.keys(c.equipment)).toHaveLength(9);
  for (const def of Object.values(c.equipment)) for (const ch of Object.values(c.characters)) {
    const targets = equipmentTargets(c, ch.id, def);
    for (const target of targets) {
      const allocation: DemoEquipment = {instanceId: "gear:1", definitionId: def.id, ownerId: ch.id, ...(def.scope === "native-face" ? {targetFaceId: target.id} : {})};
      const progress = {appliedGrowthIds: [], equipment: [allocation]};
      const after = resolveDemoCharacter(c, progress, ch.id);
      expect(resolveDemoCharacter(c, progress, ch.id)).toEqual(after);
      for (let i = 0; i < 6; i++) {
        const before = ch.faces[i], face = after.faces[i];
        const changed = def.scope === "native-face" ? before.id === target.id : c.actions[before.actionId].kind === "blank";
        expect(face).toEqual({...before, ...(changed ? {actionId: `action.${def.replacement}`, power: def.scope === "native-face" && def.operation === "boost" ? before.power + 1 : def.power} : {})});
      }
      expect(resolveDemoCharacter(c, {appliedGrowthIds: [], equipment: []}, ch.id).faces).toEqual(ch.faces);
    }
  }
});
it("excludes special actions and accepts six owners while preserving legacy limits", () => {
  const gear = Object.values(c.characters).map((ch, i): DemoEquipment => {
    const def = Object.values(c.equipment).find(d => equipmentTargets(c, ch.id, d).length)!;
    return {instanceId: `gear:${i}`, definitionId: def.id, ownerId: ch.id, ...(def.scope === "native-face" ? {targetFaceId: equipmentTargets(c, ch.id, def)[0].id} : {})};
  });
  expect(gear).toHaveLength(6); expect(validateDemoProgress(c, {appliedGrowthIds: [], equipment: gear}).equipment).toHaveLength(6);
  expect(() => validateDemoProgress(c, {appliedGrowthIds: [], equipment: [gear[0], {...gear[0], instanceId: "gear:duplicate"}]})).toThrow();
  const needle = c.equipment["equipment.needle-case"];
  expect(equipmentTargets(c, "elora", needle).every(f => c.actions[f.actionId].kind === "heal")).toBe(true);
  const special = c.characters.elora.faces.find(f => c.actions[f.actionId].kind === "expensive-heal")!;
  expect(() => validateDemoProgress(c, {appliedGrowthIds: [], equipment: [{instanceId: "gear:bad", definitionId: needle.id, ownerId: "elora", targetFaceId: special.id}]})).toThrow();
  const legacy = validateD5Catalog(ORDINARY_DROPS_CATALOG_DATA);
  expect(legacy.data.shop).toBeUndefined(); expect(Object.keys(legacy.data.equipment)).toHaveLength(2);
  expect(() => validateDemoProgress(legacy.data, {appliedGrowthIds: [], equipment: gear})).toThrow();
});
