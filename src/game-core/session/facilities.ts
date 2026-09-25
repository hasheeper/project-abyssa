import type { ValidatedD5Catalog } from "../contracts/d5";
import { FACILITY_IDS, type FacilityId, type FacilityLevel, type FacilityCommand } from "../contracts/facilities";
import type { D5Projection } from "./d5-types";
import { campaignPhaseIndex, mansionTimeBlock } from "./d5-clock";
import * as v from "../contracts/validation";
import { sha256 } from "../contracts/sha256";
import { completeConstruction, startConstruction } from "./facility-construction";

export type { FacilityBatch, FacilityState } from "./facility-types";
const identity = (prefix: string, values: unknown[]) => `${prefix}:${sha256(v.canonicalJson(values)).slice(0, 32)}`;
export function facilityTier(campaign: D5Projection, room: FacilityId): number { return Math.max(0, (campaign.facilities?.levels[room] ?? 1) - 1); }
export function facilitySupplyLimit(catalog: ValidatedD5Catalog, campaign: D5Projection): number {
  return catalog.data.facilities!.storage.slots[facilityTier(campaign, "storage")];
}
export function supplyStorageCapacity(catalog: ValidatedD5Catalog, campaign: D5Projection, id: string): number {
  const limit = catalog.data.journey!.items[id].capacity;
  return catalog.data.facilities ? limit * catalog.data.facilities.storage.supplies[facilityTier(campaign, "storage")] : limit;
}
export function supplyStorageRoom(catalog: ValidatedD5Catalog, campaign: D5Projection, id: string): number {
  const f = campaign.facilities, order = f?.order;
  const crafting = order && catalog.data.facilities!.recipes[order.recipeId].definitionId === id ? order.quantity : 0;
  return Math.max(0, supplyStorageCapacity(catalog, campaign, id) - (campaign.supplies.find(s => s.definitionId === id)?.charges ?? 0) - (f?.reservations[id] ?? 0) - crafting);
}
/** One aggregate per definition. Acquisition provenance lives in committed facts. */
export function storeFacilitySupply(campaign: D5Projection, id: string, amount: number, proof: string) {
  const stock = campaign.supplies.find(s => s.definitionId === id);
  if (stock) { stock.charges += amount; stock.source = "supply.mansion.stock"; }
  else if (amount) campaign.supplies.push({instanceId: identity("stock", [proof, id]), definitionId: id, charges: amount, source: "supply.mansion.stock"});
}
function startBatch(catalog: ValidatedD5Catalog, campaign: D5Projection, projectId: string, proof: string, phase = campaignPhaseIndex(campaign.clock)) {
  const p = catalog.data.facilities!.projects[projectId], f = campaign.facilities!;
  f.batches[p.roomId] = {id: identity("batch", [proof, projectId]), projectId, readyAt: phase + p.phases, remaining: p.amounts[facilityTier(campaign, p.roomId)]};
}
/** Initialize only at the first free-play boundary; visiting rooms never advances time. */
export function initializeFacilities(catalog: ValidatedD5Catalog, campaign: D5Projection, proof: string) {
  const content = catalog.data.facilities;
  if (!content || campaign.facilities || !["completed", "exempt"].includes(campaign.tutorial?.status ?? "")) return;
  campaign.facilities = {startedAt: campaignPhaseIndex(campaign.clock), levels: Object.fromEntries(FACILITY_IDS.map(id => [id, content.rooms[id].initialLevel])) as Record<FacilityId, FacilityLevel>,
    enabledBy: {kitchen: proof, storage: proof}, materials: {}, batches: {}, selectedProject: "production.herb", order: null, reservations: {}, overflow: {}};
  for (const supply of campaign.supplies) supply.source = "supply.mansion.stock";
  startBatch(catalog, campaign, "production.food", proof);
}
/** Save-specific, week-specific; independent of wall time and every other RNG. */
export function weeklyPublicGrant(seed: string, week: number, amounts: readonly number[]): number {
  return amounts[Number.parseInt(sha256(v.canonicalJson(["public-funds-v1", seed, week])).slice(0, 12), 16) % amounts.length];
}
/** Called only while replaying committed progression, never by a view or a timer. */
export function advanceFacilities(catalog: ValidatedD5Catalog, campaign: D5Projection, proof: string) {
  initializeFacilities(catalog, campaign, proof);
  const config = catalog.data.facilities?.construction, f = campaign.facilities;
  if (!config || !f) return;
  const week = Math.floor((campaign.clock.day - 1) / 7);
  if (!f.funding) {
    f.funding = {seed: proof, paidThroughWeek: week, totalGranted: config.funding.initial, lastAmount: config.funding.initial};
    f.construction = null;
    campaign.funds.public += config.funding.initial;
  }
  while (f.funding.paidThroughWeek < week) {
    const amount = weeklyPublicGrant(f.funding.seed, ++f.funding.paidThroughWeek, config.funding.weekly);
    campaign.funds.public += amount; f.funding.totalGranted += amount; f.funding.lastAmount = amount;
  }
  const project = f.construction;
  if (project && campaignPhaseIndex(campaign.clock) >= project.readyAt) {
    campaign.facilities = completeConstruction(f, project, campaignPhaseIndex(campaign.clock));
    campaign.facilities.construction = null;
    if (!project.fromLevel) {
      campaign.facilities.enabledBy[project.roomId] = project.id;
      if (project.roomId === "greenhouse") startBatch(catalog, campaign, f.selectedProject, project.id, project.readyAt);
    }
  }
}
export function applyFacilityCommand(catalog: ValidatedD5Catalog, campaign: D5Projection, command: FacilityCommand, proof: string) {
  const content = catalog.data.facilities, f = campaign.facilities;
  if (!content || !f) v.invalid("facilities", "Facilities are unavailable", "content-unavailable");
  const blocked = mansionTimeBlock(campaign);
  if (blocked) v.invalid("facilities", blocked, "command-not-available");
  const now = campaignPhaseIndex(campaign.clock);
  if (command.type === "facility-build") {
    const config = content.construction;
    if (!config || !f.funding) v.invalid("construction", "Construction is unavailable", "content-unavailable");
    if (campaign.clock.day < content.rooms[command.roomId].availableDay) v.invalid("construction", "Room is not yet available", "command-not-available");
    const quote = startConstruction(content, f, f.construction ?? null, command.roomId, config.basePrices[command.roomId], now);
    if (command.fromLevel !== quote.fromLevel || command.quotedCost !== quote.cost) v.invalid("construction", "Construction quote is stale", "command-not-available");
    if (campaign.funds.public < quote.cost) v.invalid("funds.public", "Not enough public funds", "insufficient-funds");
    campaign.funds.public -= quote.cost;
    f.construction = {...quote, id: proof, startedAt: now};
  } else if (command.type === "facility-enable") {
    if (content.construction) v.invalid("facility", "Use a paid initial repair", "command-not-available");
    const room = content.rooms[command.roomId];
    if (f.levels[command.roomId] !== 0 || campaign.clock.day < room.availableDay) v.invalid("facility", "Facility cannot be enabled yet", "command-not-available");
    f.levels[command.roomId] = 1; f.enabledBy[command.roomId] = proof;
    if (command.roomId === "greenhouse") startBatch(catalog, campaign, f.selectedProject, proof);
  } else if (command.type === "facility-plant") {
    const p = v.reference(content.projects, command.projectId, "projectId");
    if (p.roomId !== "greenhouse" || !f.levels.greenhouse || f.selectedProject === p.id) v.invalid("project", "Cannot select this planting project", "command-not-available");
    // Changing the next crop never discards or rerolls the in-flight harvest.
    f.selectedProject = p.id;
  } else if (command.type === "facility-collect") {
    const b = f.batches[command.roomId];
    if (!b || b.id !== command.batchId || b.readyAt > now) v.invalid("batch", "Batch is not ready", "command-not-available");
    const p = content.projects[b.projectId];
    const room = p.kind === "supply" ? supplyStorageRoom(catalog, campaign, p.definitionId) : content.storage.materials[facilityTier(campaign, "storage")] - (f.materials[p.definitionId] ?? 0);
    const amount = v.number(command.quantity, "quantity", 1, Math.min(room, b.remaining));
    if (p.kind === "supply") storeFacilitySupply(campaign, p.definitionId, amount, proof);
    else f.materials[p.definitionId] = (f.materials[p.definitionId] ?? 0) + amount;
    b.remaining -= amount;
    if (!b.remaining) startBatch(catalog, campaign, p.roomId === "greenhouse" ? f.selectedProject : p.id, proof);
  } else if (command.type === "facility-craft") {
    const r = v.reference(content.recipes, command.recipeId, "recipeId");
    if (!f.levels.workshop || f.order || f.construction?.roomId === "workshop") v.invalid("workshop", "Workshop is unavailable or occupied", "command-not-available");
    const quantity = v.number(command.quantity, "quantity", 1, content.craftBatch[facilityTier(campaign, "workshop")]);
    if (supplyStorageRoom(catalog, campaign, r.definitionId) < quantity) v.invalid("stock", "No room for crafted supplies", "inventory-full");
    if (campaign.funds.party < r.fee * quantity) v.invalid("funds", "Not enough party funds", "insufficient-funds");
    for (const [id, amount] of Object.entries(r.materials)) if ((f.materials[id] ?? 0) < amount * quantity) v.invalid("materials", "Not enough ingredients", "command-not-available");
    for (const [id, amount] of Object.entries(r.materials)) f.materials[id] -= amount * quantity;
    campaign.funds.party -= r.fee * quantity;
    f.order = {id: identity("craft", [proof, r.id]), recipeId: r.id, quantity, readyAt: now + r.phases};
  } else if (command.type === "facility-claim") {
    const order = f.order;
    if (!order || order.id !== command.orderId || order.readyAt > now) v.invalid("order", "Order is not ready", "command-not-available");
    f.order = null;
    storeFacilitySupply(campaign, content.recipes[order.recipeId].definitionId, order.quantity, proof);
  } else {
    v.reference(catalog.data.journey!.items, command.definitionId, "definitionId");
    const amount = v.number(command.quantity, "quantity", 1, Math.min(f.overflow[command.definitionId] ?? 0, supplyStorageRoom(catalog, campaign, command.definitionId)));
    f.overflow[command.definitionId] -= amount;
    storeFacilitySupply(campaign, command.definitionId, amount, proof);
  }
}
