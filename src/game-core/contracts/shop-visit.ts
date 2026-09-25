import * as v from "./validation";

/** A separately versioned scene cursor. The historical four-line introduction
 * and its catalog hashes remain readable without reinterpreting old facts. */
export const SHOP_VISIT_PHASES = ["arrival", "appraise", "valuation", "reply", "sell", "purchase", "buy", "departure"] as const;
export type ShopVisitPhase = typeof SHOP_VISIT_PHASES[number];
export const SHOP_VISIT_LENGTHS = {arrival: 31, appraise: 1, valuation: 18, reply: 3, sell: 1, purchase: 5, buy: 1, departure: 8} as const;
export const SHOP_VISIT_IDS = {
  coins: "loot.tutorial.cross-coins", nail: "loot.tutorial.barrier-nail",
  token: "loot.tutorial.candle-token", bread: "loot.tutorial.black-bread",
} as const;
export type ShopVisitProgress = {
  version: 1; status: "active" | "completed"; phase: ShopVisitPhase; step: number;
  items: Record<keyof typeof SHOP_VISIT_IDS, string>; choice: "A" | "B" | null;
};
export type ShopVisitCommand =
  | {type: "begin-shop-visit"; shopId: string}
  | {type: "advance-shop-visit"; shopId: string; phase: ShopVisitPhase; step: number; choice: "continue" | "A" | "B"}
  | {type: "appraise-shop-visit"; shopId: string; quoteVersion: number}
  | {type: "sell-shop-visit"; shopId: string; quoteVersion: number};

export function parseShopVisitCommand(raw: unknown): ShopVisitCommand {
  const c = v.record(raw, "shopVisit.command");
  const type = v.choice(c.type, ["begin-shop-visit", "advance-shop-visit", "appraise-shop-visit", "sell-shop-visit"], "type");
  v.record(c, "shopVisit.command", ["type", "shopId", ...(type === "advance-shop-visit" ? ["phase", "step", "choice"] : type === "begin-shop-visit" ? [] : ["quoteVersion"])]);
  const shopId = v.id(c.shopId, "shopId");
  if (type === "begin-shop-visit") return {type, shopId};
  if (type !== "advance-shop-visit") return {type, shopId, quoteVersion: v.number(c.quoteVersion, "quoteVersion", 1)};
  return {type, shopId, phase: v.choice(c.phase, SHOP_VISIT_PHASES, "phase"), step: v.number(c.step, "step", 0, 100), choice: v.choice(c.choice, ["continue", "A", "B"], "choice")};
}
