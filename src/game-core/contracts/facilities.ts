import * as v from "./validation";

export const FACILITY_IDS = ["kitchen", "greenhouse", "workshop", "storage", "maid"] as const;
export type FacilityId = typeof FACILITY_IDS[number];
export type FacilityLevel = 0 | 1 | 2 | 3;
export type FacilityContent = {
  version: 1;
  rooms: Record<FacilityId, {name: string; initialLevel: FacilityLevel; availableDay: number}>;
  materials: Record<string, {id: string; name: string; description: string}>;
  projects: Record<string, {id: string; roomId: "kitchen" | "greenhouse"; definitionId: string; kind: "supply" | "material"; phases: number; amounts: [number, number, number]}>;
  recipes: Record<string, {id: string; name: string; definitionId: string; materials: Record<string, number>; fee: number; phases: number}>;
  storage: {slots: [number, number, number]; materials: [number, number, number]; supplies: [number, number, number]};
  craftBatch: [number, number, number];
  repairDiscount: [number, number, number];
  construction?: {
    basePrices: Record<FacilityId, number>;
    funding: {initial: number; weekly: number[]};
  };
};
export type FacilityCommand =
  | {type: "facility-enable"; roomId: FacilityId}
  | {type: "facility-build"; roomId: FacilityId; fromLevel: FacilityLevel; quotedCost: number}
  | {type: "facility-plant"; projectId: string}
  | {type: "facility-collect"; roomId: FacilityId; batchId: string; quantity: number}
  | {type: "facility-craft"; recipeId: string; quantity: number}
  | {type: "facility-claim"; orderId: string}
  | {type: "facility-store-return"; definitionId: string; quantity: number};
export function parseFacilityCommand(raw: unknown): FacilityCommand {
  const c = v.record(raw, "facility.command"), type = v.choice(c.type, ["facility-enable", "facility-build", "facility-plant", "facility-collect", "facility-craft", "facility-claim", "facility-store-return"], "facility.type");
  const fields = type === "facility-build" ? ["roomId", "fromLevel", "quotedCost"] : type === "facility-enable" ? ["roomId"] : type === "facility-plant" ? ["projectId"] : type === "facility-collect" ? ["roomId", "batchId", "quantity"] : type === "facility-craft" ? ["recipeId", "quantity"] : type === "facility-claim" ? ["orderId"] : ["definitionId", "quantity"];
  v.record(c, "facility.command", ["type", ...fields]);
  if ("roomId" in c) v.choice(c.roomId, FACILITY_IDS, "roomId");
  for (const key of ["projectId", "batchId", "recipeId", "orderId", "definitionId"]) if (key in c) v.id(c[key], key);
  if ("quantity" in c) v.number(c.quantity, "quantity", 1, 999);
  if (type === "facility-build") { v.number(c.fromLevel, "fromLevel", 0, 2); v.number(c.quotedCost, "quotedCost", 1, 800_000); }
  return structuredClone(c) as FacilityCommand;
}
export function parseSupplyQuantities(raw: unknown): Record<string, number> {
  const q = v.record(raw, "supplyQuantities");
  v.list(Object.keys(q), "supplyQuantities", 6);
  for (const [id, amount] of Object.entries(q)) { v.id(id, "definitionId"); v.number(amount, "quantity", 1, 4); }
  return structuredClone(q) as Record<string, number>;
}
export function validateFacilityContent(raw: unknown, catalog: {journey?: {items: Record<string, unknown>}}): void {
  const c = v.record(raw, "facilities", ["version", "rooms", "materials", "projects", "recipes", "storage", "craftBatch", "repairDiscount"], ["construction"]);
  v.choice(c.version, [1], "facilities.version");
  const rooms = v.record(c.rooms, "rooms", [...FACILITY_IDS]);
  for (const value of Object.values(rooms)) {
    const r = v.record(value, "facility", ["name", "initialLevel", "availableDay"]);
    v.text(r.name, "name", 40); v.number(r.initialLevel, "level", 0, 3); v.number(r.availableDay, "day", 1, 366);
  }
  const materials = v.record(c.materials, "materials"), projects = v.record(c.projects, "projects"), recipes = v.record(c.recipes, "recipes");
  for (const [id, value] of Object.entries(materials)) {
    const m = v.record(value, id, ["id", "name", "description"]);
    if (m.id !== id) v.invalid(id, "Material identity differs");
    v.id(id, id); v.text(m.name, id, 40); v.text(m.description, id, 300);
  }
  const triple = (raw: unknown, name: string, max: number) => { const a = v.list(raw, name, 3); if (a.length !== 3) v.invalid(name, "Three levels required"); a.forEach(n => v.number(n, name, 1, max)); };
  for (const [id, value] of Object.entries(projects)) {
    const p = v.record(value, id, ["id", "roomId", "definitionId", "kind", "phases", "amounts"]);
    if (p.id !== id) v.invalid(id, "Project identity differs");
    v.choice(p.roomId, ["kitchen", "greenhouse"], id); v.choice(p.kind, [p.roomId === "kitchen" ? "supply" : "material"], id);
    v.reference(p.kind === "supply" ? catalog.journey!.items : materials, p.definitionId, id);
    v.number(p.phases, id, 1, 28); triple(p.amounts, id, 99);
  }
  for (const [id, value] of Object.entries(recipes)) {
    const r = v.record(value, id, ["id", "name", "definitionId", "materials", "fee", "phases"]);
    if (r.id !== id) v.invalid(id, "Recipe identity differs");
    v.text(r.name, id, 40); v.reference(catalog.journey!.items, r.definitionId, id);
    const ingredients = v.record(r.materials, id);
    if (!Object.keys(ingredients).length) v.invalid(id, "A recipe requires materials");
    for (const [mid, qty] of Object.entries(ingredients)) { v.reference(materials, mid, id); v.number(qty, id, 1, 99); }
    v.number(r.fee, id, 0, 50_000); v.number(r.phases, id, 1, 28);
  }
  for (const [id, roomId, definitionId] of [["production.food", "kitchen", "item.food"], ["production.herb", "greenhouse", "material.medicinal-herb"]]) {
    const project = v.record(v.reference(projects, id, "defaultProject"), id);
    if (project.roomId !== roomId || project.definitionId !== definitionId) v.invalid(id, "Invalid initial production project");
  }
  if (!Object.keys(recipes).length) v.invalid("recipes", "At least one real recipe is required");
  const storage = v.record(c.storage, "storage", ["slots", "materials", "supplies"]);
  triple(storage.slots, "slots", 6); triple(storage.materials, "materials", 999); triple(storage.supplies, "supplies", 99);
  triple(c.craftBatch, "craftBatch", 99); triple(c.repairDiscount, "discount", 15);
  if (c.construction !== undefined) {
    const build = v.record(c.construction, "construction", ["basePrices", "funding"]);
    const prices = v.record(build.basePrices, "basePrices", [...FACILITY_IDS]);
    Object.values(prices).forEach(price => v.number(price, "basePrice", 1, 400_000));
    const funding = v.record(build.funding, "funding", ["initial", "weekly"]);
    v.number(funding.initial, "initial", 1, 2_000_000);
    const amounts = v.list(funding.weekly, "weekly", 20);
    if (!amounts.length) v.invalid("weekly", "At least one weekly payment is required");
    amounts.forEach(amount => v.number(amount, "weeklyAmount", 1, 2_000_000));
  }
}
