import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import type { D5Projection, ShopIntroductionAdvance } from "./d5-types";

/** Eligibility is save-owned; visiting a route does not consume the scene. */
export function shopIntroductionView(catalog: ValidatedD5Catalog, state: D5Projection) {
  const spec = catalog.data.shopIntroduction, progress = state.shopIntroduction;
  const tutorialReady = state.tutorial?.status === "completed" || state.tutorial?.status === "exempt";
  if (!spec || progress?.status !== "pending" || !tutorialReady ||
    state.prologue?.status === "playing" || state.opening?.status === "playing" || state.activeRunRef || state.activeStoryId) return null;
  return {...spec, step: progress.step};
}

export function validateShopIntroductionAdvance(catalog: ValidatedD5Catalog, event: ShopIntroductionAdvance) {
  const spec = catalog.data.shopIntroduction;
  if (!spec || event.shopId !== spec.shopId) v.invalid("shopIntroduction", "Unknown shop introduction", "content-unavailable");
  v.number(event.step, "shopIntroduction.step", 0, spec.lastStep);
  v.choice(event.choice, ["continue", "skip"], "shopIntroduction.choice");
}

export function advanceShopIntroduction(catalog: ValidatedD5Catalog, state: D5Projection, event: ShopIntroductionAdvance) {
  validateShopIntroductionAdvance(catalog, event);
  const view = shopIntroductionView(catalog, state);
  if (!view || view.step !== event.step) v.invalid("shopIntroduction", "Unavailable or stale introduction cursor", "command-not-available");
  const progress = state.shopIntroduction!;
  if (event.choice === "skip") {progress.step = view.lastStep; progress.status = "skipped";}
  else if (progress.step === view.lastStep) progress.status = "viewed";
  else progress.step++;
}
