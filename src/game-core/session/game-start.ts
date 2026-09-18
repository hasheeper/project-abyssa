import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import { GAME_START_POINTS, type D5Projection, type GameStartPoint } from "./d5-types";

export function validateGameStart(catalog: ValidatedD5Catalog, startAt: GameStartPoint) {
  v.choice(startAt, GAME_START_POINTS, "startAt");
  if (catalog.ref.contentVersion < 11 || !catalog.data.prologue || !catalog.data.opening || !catalog.data.tutorial?.guide)
    v.invalid("startAt", "Start selection requires the guided demo release", "content-unavailable");
}

/** Only the first committed progression may select a starting point. No victory,
 * dialogue choices, rewards, supplies or elapsed world time are invented here. */
export function applyGameStart(catalog: ValidatedD5Catalog, state: D5Projection, startAt: GameStartPoint) {
  validateGameStart(catalog, startAt);
  if (startAt === "prologue") return;
  state.prologue!.status = "skipped";
  if (startAt === "first-morning") return;
  state.opening = {step: catalog.data.opening!.lastStep, status: "skipped", choices: []};
  if (startAt === "hub") state.tutorial = {status: "exempt", reason: "player-skipped"};
}
