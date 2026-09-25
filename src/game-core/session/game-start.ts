import * as v from "../contracts/validation";
import type { ValidatedD5Catalog } from "../contracts/d5";
import { GAME_START_POINTS, type D5Projection, type GameStartPoint } from "./d5-types";
import { parsePlayerName } from "../contracts/player-name";
import { sha256 } from "../contracts/sha256";
import { initialLootResult } from "../contracts/loot";

export function validateGameStart(catalog: ValidatedD5Catalog, startAt: GameStartPoint) {
  v.choice(startAt, GAME_START_POINTS, "startAt");
  if (catalog.ref.contentVersion < 11 || !catalog.data.prologue || !catalog.data.opening || !catalog.data.tutorial?.guide)
    v.invalid("startAt", "Start selection requires the guided demo release", "content-unavailable");
  if (startAt === "debug-shop" && (!catalog.data.shopIntroduction || !catalog.data.tutorialSkipReward))
    v.invalid("startAt", "Shop debugging requires the introduction and starter reward", "content-unavailable");
  if (startAt === "airp-director" && !catalog.data.airpDirector) v.invalid("startAt", "Director start requires content19", "content-unavailable");
  if (startAt === "airp-demo" && !catalog.data.airpDirect)
    v.invalid("startAt", "AIRP quick start requires the direct release", "content-unavailable");
}

/** Access is not completion. Growth and memory chapter gates still require the real takeover. */
export function hasManorPatrolAccess(state: Pick<D5Projection, "manor" | "airpDemoStart">): boolean {
  return !!state.manor.takeover || state.airpDemoStart?.id === "start.airp.patrol";
}

/** The first committed progression owns the skip reward. Its fact identity makes
 * asset IDs stable through replay; no expedition or dialogue history is fabricated. */
export function applyGameStart(catalog: ValidatedD5Catalog, state: D5Projection, startAt: GameStartPoint, claimId: string, playerName?: string) {
  validateGameStart(catalog, startAt);
  if (playerName !== undefined) state.playerName = parsePlayerName(playerName);
  if (startAt === "prologue") return;
  state.prologue!.status = "skipped";
  if (startAt === "first-morning") return;
  state.opening = {step: catalog.data.opening!.lastStep, status: "skipped", choices: []};
  if (startAt !== "hub" && startAt !== "debug-shop" && startAt !== "airp-demo" && startAt !== "airp-director") return;
  if (startAt === "airp-director") state.airpDemoStart = {...catalog.data.airpDirector!.demoStart, claimId};
  if (startAt === "airp-demo") state.airpDemoStart = {...catalog.data.airpDirect!.demoStart, claimId};
  state.tutorial = {status: "exempt", reason: "player-skipped"};
  // The explicit debug start keeps the normal first-visit cursor and rewards.
  if (state.shopIntroduction && startAt !== "debug-shop") state.shopIntroduction.status = "exempt";
  const reward = catalog.data.tutorialSkipReward;
  if (!reward) return;
  const identity = (kind: string, definitionId: string) => `${kind}:${sha256(v.canonicalJson([claimId, reward.id, definitionId])).slice(0, 32)}`;
  const receipt: NonNullable<D5Projection["startReward"]> = {
    id: claimId, rewardId: reward.id, gold: reward.gold,
    supplies: reward.supplies.map(s => ({...s, instanceId: identity("supply", s.definitionId),
      source: catalog.data.facilities ? "supply.mansion.stock" : catalog.data.economy!.freeItemIds.includes(s.definitionId) ? "supply.demo.allowance" : "supply.demo.shop"})),
    loot: reward.lootDefinitionIds.map(definitionId => ({instanceId: identity("loot", definitionId), definitionId,
      grantId: reward.id, source: "tutorial-skip", claimId, resultId: initialLootResult(catalog.data.loot!.definitions[definitionId])})),
  };
  state.funds.party += receipt.gold;
  state.supplies.push(...structuredClone(receipt.supplies));
  state.loot!.push(...structuredClone(receipt.loot));
  state.startReward = receipt;
}
