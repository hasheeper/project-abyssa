import { describe, expect, it } from "vitest";
import { DIRECTOR_CAPABILITIES as capabilities, DIRECTOR_FIXED_CARDS as fixed, directorAuthorSource } from "../../content/gameplay/airp-director/content";
import { AIRP_POOL_CONTENT } from "../../content/gameplay/airp-v2/content";
import { emptyDirectorBudget, type DirectorCard, type DirectorPlanProposal, type DirectorWorld } from "../contracts/airp-director";
import { parseDirectorCard, parseDirectorPlan, parseDirectorReview } from "../contracts/airp-director-validation";
import { directorActorLocation, directorHash, directorSceneId, validateDirectorPlan } from "./airp-director-rules";
import { validateD5Catalog } from "../contracts/d5-validation";
import { AIRP_DIRECT_CATALOG_DATA } from "../../content/gameplay/demo-v18/content";
import { parseAirpPoolCommand } from "../contracts/airp-pool-validation";

function world(): DirectorWorld {
  return {head: {saveId: "test", epoch: "epoch", revision: 1}, phase: 0, eligible: true,
    availableActorIds: [...capabilities.actorIds], occupiedActorIds: [], sourceIds: ["fact:1"],
    existing: [], requiredStoryIds: [], busyFocus: false, themes: [], uniqueCompletedIds: [], followups: []};
}
function plan(ids = [0]): DirectorPlanProposal {
  return {version: 1, day: 1, reason: "根据已提交情况安排，保留空窗。", focus: ids.some(i => i !== 2) ? {kind: "new", id: `entry:${ids.find(i => i !== 2)}`} : null,
    entries: ids.map(i => ({id: `entry:${i}`, fromPhase: 2, throughPhase: 2, basisIds: ["fact:1"], source: {kind: "fixed", definitionId: fixed[i].card.id}}))};
}
const check = (proposal = plan(), w = world(), extra = {}) => validateDirectorPlan({proposal, capabilities, world: w, fixed, budget: emptyDirectorBudget(1), ...extra});
function freePlan() {
  const p = plan([2]), card = structuredClone(fixed[2].card);
  card.id = "free:new"; card.themeKey = "house.new-topic"; card.title = "开发自由小景";
  p.entries[0].source = {kind: "free", card};
  return p;
}
function review(p: DirectorPlanProposal) {
  return {version: 1, planHash: directorHash(p), decisions: p.entries.filter(e => e.source.kind === "free").map(e => ({entryId: e.id, verdict: "new", matchedSourceIds: [], reason: "与提供的活动主题及黑名单逐项比较后为新题。"}))};
}
describe("Director GM-A closed contracts", () => {
  it("keeps the three exact author working drafts and their source digests", () => {
    for (const f of fixed) {
      expect(parseDirectorCard(f.card)).toEqual(f.card);
      expect(f.authorStatus).toBe("working-draft");
      expect(directorHash(directorAuthorSource(f.sourceId))).toBe(f.sourceDigest);
      expect(directorAuthorSource(f.sourceId).card).toEqual(AIRP_POOL_CONTENT.cards.find(c => c.id === f.sourceId));
    }
  });
  it.each(["rewardGold", "script", "effects", "isFollowup", "apiKey"])("rejects unauthorized card field %s", field => {
    expect(() => parseDirectorCard({...fixed[0].card, [field]: "injected"})).toThrow();
  });
  it("rejects wrong versions, canon generation, duplicate choices and unknown action commands", () => {
    for (const patch of [{version: 2}, {tier: "canon"}, {choices: [...fixed[0].card.choices, ...fixed[0].card.choices]}, {actions: [{...fixed[0].card.actions[0], kind: "eval"}]}]) expect(() => parseDirectorCard({...fixed[0].card, ...patch})).toThrow();
  });
  it("prevents fake lightweight multi-step errands and short invented deadlines", () => {
    expect(() => parseDirectorCard({...fixed[1].card, load: "light"})).toThrow();
    expect(() => parseDirectorCard({...fixed[0].card, offerPhases: 1})).toThrow();
    expect(() => parseDirectorCard({...fixed[0].card, aftermath: {intent: "someone did it", actorIds: ["elora"]}})).toThrow();
  });
  it("accepts zero events, only a vignette, and one focus plus one vignette", () => {
    expect(check(plan([])).entries).toHaveLength(0);
    expect(check(plan([2])).entries).toHaveLength(1);
    expect(check(plan([0, 2])).entries).toHaveLength(2);
  });
  it("rejects two complex events and two side scenes even under the total cap", () => {
    expect(() => check(plan([0, 1]))).toThrow();
    const p = freePlan();
    p.entries.push({...plan([2]).entries[0], id: "entry:another", fromPhase: 3, throughPhase: 3});
    expect(() => check(p, world(), {review: review(p)})).toThrow();
  });
  it("shares published capacity across sources and does not refill completed offers", () => {
    const budget = {day: 1, publishedIds: ["done:focus", "declined:light"], focusIds: ["done:focus"], lightIds: ["declined:light"]};
    expect(() => check(freePlan(), world(), {budget, review: review(freePlan())})).toThrow();
    expect(check(plan([]), world(), {budget}).entries).toHaveLength(0);
  });
  it.each(["offered", "accepted", "ready"] as const)("counts old %s focus as daily load without changing it", status => {
    const w = world(); w.existing.push({id: "old", load: "focus", status, form: "liaison"});
    const before = structuredClone(w);
    expect(() => check(plan([0]), w)).toThrow();
    const p = plan([2]); p.focus = {kind: "existing", id: "old"};
    expect(check(p, w).entries).toHaveLength(1); expect(w).toEqual(before);
  });
  it("does not treat story and patrol workload as free extra capacity", () => {
    const w = world(); w.requiredStoryIds = ["story:1"];
    expect(() => check(plan(), w)).toThrow();
    const p = plan([]); p.focus = {kind: "story", id: "story:1"}; expect(check(p, w).entries).toHaveLength(0);
    w.requiredStoryIds = []; w.busyFocus = true; expect(() => check(plan(), w)).toThrow();
  });
  it("requires real sources, exact day, legitimate focus and matching meeting location", () => {
    const variants = [plan(), plan(), plan(), plan()];
    variants[0].entries[0].basisIds = ["future:choice"];
    variants[1].day = 2; variants[2].focus = {kind: "new", id: "missing"};
    variants[3].entries[0].fromPhase = 0; variants[3].entries[0].throughPhase = 0;
    variants.forEach(p => expect(() => check(p)).toThrow());
    const w = world(); w.phase = 3; expect(() => check(plan(), w)).toThrow();
  });
  it("shares the actual mansion location and availability query", () => {
    const w = world();
    expect(directorActorLocation(capabilities, w, "elora", 0)).toBe("elora");
    expect(directorActorLocation(capabilities, w, "elora", 2)).toBe("plaza");
    w.occupiedActorIds = ["elora"]; expect(() => check(plan(), w)).toThrow();
    w.occupiedActorIds = []; w.availableActorIds = ["kororo"]; expect(() => check(plan([1]), w)).toThrow();
  });
  it("rejects model-invented actors, places, objects and patrol objectives", () => {
    for (const part of ["actor", "place", "object", "objective"]) {
      const card = structuredClone(fixed[0].card);
      if (part === "actor") { card.giverId = "invented"; card.actorIds.push("invented"); }
      if (part === "place") card.locationId = "invented";
      if (part === "object") card.objectIds = ["invented"];
      if (part === "objective" && card.actions[0].kind === "patrol") card.actions[0].objectiveId = "invented";
      const p = plan(); p.entries[0].source = {kind: "free", card};
      expect(() => check(p, world(), {review: review(p)})).toThrow();
    }
  });
  it("enforces 256-phase cooling and unique completion independently", () => {
    const w = world(); w.themes = [{key: fixed[0].card.themeKey, description: "same", objectIds: [], sourceId: "closed", untilPhase: 256}];
    w.phase = 255; const p = plan(); p.day = 64; p.entries[0].fromPhase = 255; p.entries[0].throughPhase = 255;
    // Use a meeting window in the new day to isolate the exact cooldown edge.
    const c = structuredClone(capabilities); c.locations.elora.night = "plaza";
    expect(() => validateDirectorPlan({proposal: p, capabilities: c, world: w, fixed, budget: emptyDirectorBudget(64)})).toThrow(/cooling/);
    w.phase = 256; p.day = 65; p.entries[0].fromPhase = 258; p.entries[0].throughPhase = 258;
    expect(validateDirectorPlan({proposal: p, capabilities, world: w, fixed, budget: emptyDirectorBudget(65)}).entries).toHaveLength(1);
    w.uniqueCompletedIds = [fixed[0].card.id];
    expect(() => validateDirectorPlan({proposal: p, capabilities, world: w, fixed, budget: emptyDirectorBudget(65)})).toThrow(/Unique/);
  });
  it("requires independent, exact-plan semantic review for every free card", () => {
    const p = freePlan(); expect(() => check(p)).toThrow();
    expect(check(p, world(), {review: review(p)}).entries[0].origin).toBe("free");
    for (const patch of [{planHash: "0".repeat(64)}, {decisions: []}, {decisions: [{...review(p).decisions[0], verdict: "uncertain"}]}, {decisions: [{...review(p).decisions[0], verdict: "same", matchedSourceIds: ["previous"]}]}]) expect(() => check(p, world(), {review: {...review(p), ...patch}})).toThrow();
  });
  it("does not let a new review override deterministic cross-library blacklisting", () => {
    const p = plan(), card = {...structuredClone(fixed[0].card), id: "renamed", title: "another box", themeKey: "new-key"};
    p.entries[0].source = {kind: "free", card}; const w = world();
    w.themes = [{key: fixed[0].card.themeKey, description: "same promise", objectIds: fixed[0].card.objectIds, sourceId: "old", untilPhase: null}];
    expect(() => check(p, w, {review: review(p)})).toThrow(/occupied/);
  });
  it("requires a verified unconsumed parent slot and cannot turn it into another errand", () => {
    const p = plan([2]); p.entries[0].source = {kind: "followup", parentId: "parent"};
    expect(() => check(p)).toThrow();
    const w = world(), card: DirectorCard = {...structuredClone(fixed[2].card), themeKey: "parent.theme"};
    w.themes = [{key: "parent.theme", description: "parent", objectIds: [], sourceId: "parent", untilPhase: 256}];
    w.followups = [{parentId: "parent", card, eligible: true, consumed: false}];
    expect(check(p, w).entries[0].parentId).toBe("parent");
    w.followups[0].consumed = true; expect(() => check(p, w)).toThrow();
    w.followups[0].consumed = false; w.followups[0].card = structuredClone(fixed[0].card); expect(() => check(p, w)).toThrow();
  });
  it("changes scene identity for true action attempts, not HTTP retries", () => {
    const id = directorSceneId("event:1", "feedback", 0, 1);
    expect(directorSceneId("event:1", "feedback", 0, 1)).toBe(id);
    expect(directorSceneId("event:1", "feedback", 0, 2)).not.toBe(id);
    expect(directorSceneId("event:1", "result", 0, 1)).not.toBe(id);
  });
  it("does not widen old pool commands or content18", () => {
    expect(validateD5Catalog(AIRP_DIRECT_CATALOG_DATA).ref.contentVersion).toBe(18);
    expect(() => validateD5Catalog({...AIRP_DIRECT_CATALOG_DATA, airpDirector: {version: 1}})).toThrow();
    expect(() => parseAirpPoolCommand({type: "airp-director-plan", proposal: plan()})).toThrow();
    expect(() => parseDirectorPlan({...plan(), reward: 1})).toThrow();
    expect(() => parseDirectorReview({...review(freePlan()), effects: []})).toThrow();
  });
});
