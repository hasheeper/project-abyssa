import type { ValidatedD5Catalog } from "../contracts/d5";
import * as v from "../contracts/validation";
import { SHOP_VISIT_IDS, SHOP_VISIT_LENGTHS, SHOP_VISIT_PHASES, type ShopVisitCommand, type ShopVisitPhase } from "../contracts/shop-visit";
import type { D5Projection } from "./d5-types";
import { lootQuote } from "./d5-loot";
import { lootSalePrice } from "../contracts/loot";

function atCounter(state: D5Projection) {
  return !state.activeRunRef && !state.activeStoryId && state.prologue?.status !== "playing" && state.opening?.status !== "playing" &&
    (state.tutorial?.status === "completed" || state.tutorial?.status === "exempt");
}
/** The shortcut skips play, not the authored first-act continuity. It still
 * needs the real starter lot; already sold objects are never recreated. */
export function shopVisitView(catalog: ValidatedD5Catalog, state: D5Projection) {
  if (catalog.ref.contentVersion < 17 || !atCounter(state)) return null;
  if (state.shopVisit) return state.shopVisit.status === "active" ? {progress: state.shopVisit, canBegin: false} : null;
  const nail = state.loot?.find(item => item.definitionId === SHOP_VISIT_IDS.nail &&
    catalog.data.loot!.definitions[item.definitionId].freeAppraisalGrantIds?.includes(item.grantId));
  if (!nail) return null;
  const complete = Object.values(SHOP_VISIT_IDS).every(id => state.loot?.some(item => item.claimId === nail.claimId && item.definitionId === id));
  return complete ? {progress: null, canBegin: true} : null;
}

export function applyShopVisit(catalog: ValidatedD5Catalog, state: D5Projection, command: ShopVisitCommand, factId: string) {
  if (command.shopId !== catalog.data.economy?.shopId || catalog.ref.contentVersion < 17 || !atCounter(state))
    v.invalid("shopVisit", "Shop visit is unavailable", "command-not-available");
  if (command.type === "begin-shop-visit") {
    if (!shopVisitView(catalog, state)?.canBegin) v.invalid("shopVisit", "First visit has already begun or its lot is unavailable", "command-not-available");
    const nail = state.loot!.find(item => item.definitionId === SHOP_VISIT_IDS.nail && catalog.data.loot!.definitions[item.definitionId].freeAppraisalGrantIds?.includes(item.grantId))!;
    const items = Object.fromEntries(Object.entries(SHOP_VISIT_IDS).map(([key, definitionId]) => [key,
      state.loot!.find(item => item.claimId === nail.claimId && item.definitionId === definitionId)!.instanceId])) as NonNullable<D5Projection["shopVisit"]>["items"];
    state.shopVisit = {version: 1, status: "active", phase: "arrival", step: 0, choice: null, items};
    // One authored offer, attached to these instances only; frozen old catalog
    // prices and already settled historical transactions do not change.
    state.loot!.filter(item => Object.values(items).includes(item.instanceId)).forEach(item => {item.shopVisitOffer = 1;});
    if (state.shopIntroduction?.status === "pending") state.shopIntroduction.status = "exempt";
    return;
  }
  const progress = state.shopVisit;
  if (!progress || progress.status !== "active") v.invalid("shopVisit", "No active first visit", "command-not-available");
  const enter = (phase: ShopVisitPhase) => {progress.phase = phase; progress.step = 0;};
  if (command.type === "appraise-shop-visit") {
    if (progress.phase !== "appraise" || command.quoteVersion !== catalog.data.loot!.quoteVersion) v.invalid("shopVisit", "Stale appraisal", "quote-expired");
    const item = state.loot!.find(item => item.instanceId === progress.items.nail);
    if (!item) v.invalid("shopVisit", "The nail is no longer owned", "item-unavailable");
    if (!item.resultId) {
      const quote = lootQuote(catalog, state, {type: "loot-appraised", shopId: command.shopId, instanceId: item.instanceId, quoteVersion: command.quoteVersion}, true);
      state.funds.party -= quote.gold; item.resultId = quote.definition.resultId;
      state.lootTrades!.push({id: factId, kind: "appraise", item: structuredClone(item), gold: quote.gold});
    }
    enter("valuation"); return;
  }
  if (command.type === "sell-shop-visit") {
    if (progress.phase !== "sell" || !progress.choice || command.quoteVersion !== catalog.data.loot!.quoteVersion) v.invalid("shopVisit", "Stale sale", "quote-expired");
    const ids = [progress.items.coins, progress.items.token, ...(progress.choice === "A" ? [progress.items.nail] : [])];
    // Validate the entire basket before mutation, and deduplicate the token
    // included by the ordinary coin-lot quote.
    const sale = new Map<string, {item: NonNullable<D5Projection["loot"]>[number]; gold: number}>();
    for (const instanceId of ids) {
      const quote = lootQuote(catalog, state, {type: "loot-sold", shopId: command.shopId, instanceId, quoteVersion: command.quoteVersion}, true);
      for (const item of quote.soldItems) sale.set(item.instanceId, {item, gold: lootSalePrice(catalog.data.loot!.definitions[item.definitionId], item)!});
      for (const entry of quote.bundled) sale.set(entry.item.instanceId, entry);
    }
    for (const {item, gold} of sale.values()) {
      state.funds.party += gold;
      state.lootTrades!.push({id: `${factId}:${item.instanceId}`, kind: "sell", item: structuredClone(item), gold});
    }
    state.loot = state.loot!.filter(item => !sale.has(item.instanceId));
    enter("purchase"); return;
  }
  if (command.phase !== progress.phase || command.step !== progress.step) v.invalid("shopVisit", "Stale story cursor", "command-not-available");
  if (progress.phase === "valuation" && progress.step === SHOP_VISIT_LENGTHS.valuation - 1) {
    if (command.choice !== "A" && command.choice !== "B") v.invalid("shopVisit", "Choose whether to sell the nail", "command-not-available");
    progress.choice = command.choice; enter("reply"); return;
  }
  if (command.choice !== "continue" || progress.phase === "appraise" || progress.phase === "sell") v.invalid("shopVisit", "A transaction is required", "command-not-available");
  const length = progress.phase === "reply" && progress.choice === "A" ? 2 : SHOP_VISIT_LENGTHS[progress.phase];
  if (progress.step < length - 1) {
    progress.step++;
    if (progress.phase === "valuation" && progress.step === 7) {
      const coins = state.loot!.find(item => item.instanceId === progress.items.coins);
      if (!coins || coins.sampled) v.invalid("shopVisit", "Coin sample is unavailable", "item-unavailable");
      coins.sampled = true;
    }
  } else if (progress.phase === "departure") progress.status = "completed";
  else enter(SHOP_VISIT_PHASES[SHOP_VISIT_PHASES.indexOf(progress.phase) + 1]);
}
