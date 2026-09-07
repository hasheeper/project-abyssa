import { describe, expect, it } from "vitest";
import { DEMO_CONTENT } from "../../../content/gameplay/demo-v1/content";
import {
  DEMO_FIXTURE as catalog,
  demoFixture,
  demoProgress,
} from "../../../game-runtime/testing/demo-fixtures";
import { validateDemoContent, validateDemoCatalog } from "../../contracts";
import { createDemoBattleEngine } from "../demo-engine";
import {
  resolveDemoCharacter,
  resolveDemoParty,
  validateDemoProgress,
} from "../rules/v2/configuration";
import { evaluateDemoHand } from "../rules/v2/hand";
import { resolveDemoCovenants } from "../rules/v2/covenants";
import { damageMember } from "../rules/v2/combat";
import type {
  DemoBattleState,
  DemoHand,
  DemoEvent,
} from "../domain/demo-state";

const engine = createDemoBattleEngine(catalog);
const heroes = catalog.data.initialParty;
function start(partyIds = heroes, level: 1 | 2 | 3 = 1) {
  return engine.create({
    runId: "test-run",
    routeId: "test.route",
    partyIds,
    progress: demoProgress(level),
    seed: 19,
  });
}
function faces(state: DemoBattleState, slots: number[]) {
  state.encounter.phase = "act";
  state.encounter.dice.forEach((d, i) => {
    d.faceIndex = slots[i] - 1;
    d.loaded = true;
    d.spent = false;
  });
  return state;
}
function action(
  state: DemoBattleState,
  actorId: string,
  choice: "attack" | "guard" | "heal" | "bind" | "guard-all",
  targetId: string | null,
) {
  return engine.dispatch(state, { type: "act", actorId, choice, targetId });
}
const withMari = ["kael", "eustice", "elora", "norma", "marietta"];

describe("formal character configuration", () => {
  it("validates all 36 authored faces, exact awake counts and one initial gold each; incomplete catalog cannot execute", () => {
    const content = validateDemoContent(DEMO_CONTENT, ["covenant.marietta"]);
    expect(
      Object.values(content.characters).map(
        (c) => c.faces.filter((f) => f.fate === "awake").length,
      ),
    ).toEqual([6, 5, 5, 3, 5, 4]);
    expect(
      new Set(
        Object.values(content.characters).flatMap((c) =>
          c.faces.map((f) => f.id),
        ),
      ).size,
    ).toBe(36);
    expect(
      Object.values(content.characters).map(
        (c) => c.faces.filter((f) => f.quality === "gild").length,
      ),
    ).toEqual([1, 1, 1, 1, 1, 1]);
    expect(() =>
      validateDemoCatalog({ ...catalog.data, characters: content.characters }),
    ).toThrow();
  });
  it.each([
    ["eustice", 6, 5],
    ["elora", 4, 3],
    ["kororo", 3, 5],
    ["norma", 3, 4],
    ["marietta", 5, 2],
  ] as const)(
    "%s has precise Lv2 changes and Lv3 stage replaces Lv1",
    (id, awake, gild) => {
      const second = resolveDemoCharacter(catalog.data, demoProgress(2), id),
        third = resolveDemoCharacter(catalog.data, demoProgress(3), id);
      expect(second.faces[awake - 1].fate).toBe("awake");
      expect(second.faces[gild - 1].quality).toBe("gild");
      expect(third.faces).toEqual(second.faces);
      expect(third.covenantStage).toBe(2);
      expect(second.covenantStage).toBe(1);
    },
  );
  it("derives Kael's single team milestone, rejects skipped/duplicate grants and overlapping equipment", () => {
    const p = demoProgress(3),
      c = resolveDemoCharacter(catalog.data, p, "kael");
    expect(c.faces[3]).toMatchObject({ power: 2, quality: "gild" });
    expect(c.sources).toEqual(["growth.kael.team-lv3-guard"]);
    expect(c.faces[0].rust).toBe("removable");
    expect(() =>
      validateDemoProgress(catalog.data, {
        ...p,
        appliedGrowthIds: ["growth.elora.lv3"],
      }),
    ).toThrow();
    expect(() =>
      validateDemoProgress(catalog.data, {
        ...p,
        appliedGrowthIds: ["growth.elora.lv2", "growth.elora.lv2"],
      }),
    ).toThrow();
    const item = {
      instanceId: "blade",
      definitionId: "equipment.spare-blade",
      ownerId: "kororo",
    };
    expect(() =>
      validateDemoProgress(catalog.data, {
        ...p,
        equipment: [item, { ...item, instanceId: "second" }],
      }),
    ).toThrow();
    expect(() =>
      validateDemoProgress(catalog.data, {
        ...p,
        equipment: [{ ...item, ownerId: "kael" }],
      }),
    ).toThrow();
  });
  it.each(["spare-blade", "emergency-pouch"])(
    "%s rewrites all native blanks without waking them",
    (name) => {
      const progress = demoProgress();
      progress.equipment = [
        {
          instanceId: name,
          definitionId: `equipment.${name}`,
          ownerId: "kororo",
        },
      ];
      const c = resolveDemoCharacter(catalog.data, progress, "kororo");
      expect(c.faces.slice(0, 3).map((f) => f.actionId)).toEqual(
        Array(3).fill(name === "spare-blade" ? "action.attack" : "action.heal"),
      );
      expect(c.faces.slice(0, 3).map((f) => f.fate)).toEqual(
        Array(3).fill("asleep"),
      );
      expect(c.faces.map((f) => [f.pip, f.suit, f.quality])).toEqual(
        catalog.data.characters.kororo.faces.map((f) => [
          f.pip,
          f.suit,
          f.quality,
        ]),
      );
    },
  );
  it("resolves native suit votes, heroes' rain and per-encounter sovereign aura", () => {
    expect(
      resolveDemoParty(catalog.data, demoProgress(), heroes).resonance,
    ).toEqual({ earth: true, rainy: true, sovereign: false });
    expect(
      resolveDemoParty(catalog.data, demoProgress(), withMari).resonance,
    ).toEqual({ earth: true, rainy: false, sovereign: true });
    expect(start(withMari).encounter.enemies[0].intent?.value).toBe(1);
  });
});

describe("action and hand eligibility", () => {
  it("keeps the screenshot's spent 2 in its pair while excluding Kororo's sleeping 3 at Lv1", () => {
    const s = faces(start(), [3, 1, 2, 3, 2]);
    s.encounter.dice[1].spent = true;
    s.encounter.dice[4].spent = true;
    const hand = engine.select(s).hand;
    expect(hand.name).toBe("一对");
    expect(hand.dice.map(d => d.value)).toEqual([3, 1, 2, 2]);
    expect(new Set(hand.contributors)).toEqual(new Set(["elora", "norma"]));
    expect(engine.select(s).party.find(m => m.id === "kororo")!.handEligible).toBe(false);
    const settled = engine.dispatch(s, {type: "end-turn"});
    expect(settled.state.encounter.hand).toEqual(hand);
    expect(settled.events.find(e => e.type === "hand-settled")?.payload).toMatchObject({name: "一对", bonus: 0.1});
    expect(settled.state.run.handBonus).toBe(0.1);
  });
  it("keeps both pairs in 3/1/2/3/2 after any combination of actions when all five fate faces are awake", () => {
    for (let mask = 0; mask < 32; mask++) {
      const s = faces(start(heroes, 2), [3, 1, 2, 3, 2]);
      s.encounter.dice.forEach((die,i) => {die.spent = !!(mask & (1 << i));});
      const preview = engine.select(s).hand;
      expect(preview.name).toBe("两对");
      expect(preview.adjustedBonus).toBe(0.2);
      expect(new Set(preview.contributors)).toEqual(new Set(["kael","elora","kororo","norma"]));
      const settled = engine.dispatch(s, {type:"end-turn"});
      expect(settled.state.encounter.hand).toEqual(preview);
      expect(settled.events.find(e => e.type === "hand-settled")?.payload).toMatchObject({name:"两对",bonus:0.2});
      expect(settled.state.run.handBonus).toBe(0.2);
    }
  });
  it("excludes an exhausted owner, rather than an owner whose action has been spent", () => {
    const s = faces(start(heroes, 2), [3, 1, 2, 3, 2]);
    s.encounter.dice.forEach(d => {d.spent = true;});
    s.run.party.find(m => m.id === "norma")!.hp = 0;
    const hand = engine.select(s).hand;
    expect(hand.name).toBe("一对");
    expect(hand.dice.map(d => d.ownerId)).not.toContain("norma");
    expect(new Set(hand.contributors)).toEqual(new Set(["kael","kororo"]));
    const settled = engine.dispatch(s, {type:"end-turn"});
    expect(settled.state.encounter.hand).toEqual(hand);
    expect(settled.state.run.handBonus).toBe(0.1);
  });
  it("asleep strong faces can act but not form a hand; awake blanks and spent dice still contribute", () => {
    let s = faces(start(withMari), [1, 6, 4, 3, 6]);
    expect(
      evaluateDemoHand(catalog.data, s).dice.map((d) => d.ownerId),
    ).toEqual(["kael"]);
    expect(
      engine
        .select(s)
        .party.at(-1)
        ?.actions.options.some((o) => o.choice === "attack"),
    ).toBe(true);
    s = faces(start(heroes, 2), [2, 6, 4, 3, 3]);
    s.encounter.dice[0].spent = true;
    expect(evaluateDemoHand(catalog.data, s).dice).toHaveLength(5);
    expect(engine.select(s).party[1].actions.reason).toBe("blank-face");
  });
  it.each(["attack", "guard", "heal"] as const)(
    "wild has explicit %s choice, Norma retains pip 1",
    (choice) => {
      const s = faces(start(), [6, 1, 1, 4, 1]);
      s.run.party[0].hp = 1;
      const target = choice === "heal" ? "kael" : s.encounter.enemies[0].id;
      const r = action(s, "norma", choice, target);
      expect(r.state.encounter.dice[4].spent).toBe(true);
      expect(
        evaluateDemoHand(catalog.data, r.state).dice.find(
          (d) => d.ownerId === "norma",
        )?.value,
      ).toBe(1);
    },
  );
  it("protect gives 2 to self and 3 to another; plain guard does not gain this bonus", () => {
    const s = faces(start(), [4, 1, 1, 4, 1]),
      e = s.encounter.enemies[0];
    e.intent!.targetId = "kael";
    expect(
      action(s, "kael", "guard", e.id).state.encounter.enemies[0].intent!
        .blocked,
    ).toBe(2);
    e.intent!.targetId = "elora";
    expect(
      action(s, "kael", "guard", e.id).state.encounter.enemies[0].intent!
        .blocked,
    ).toBe(3);
    s.encounter.dice[0].faceIndex = 2;
    expect(
      action(s, "kael", "guard", e.id).state.encounter.enemies[0].intent!
        .blocked,
    ).toBe(1);
  });
  it.each([0, 3, 18])(
    "expensive heal with %i loose gold only spends min(10, loose); invalid action is pure",
    (gold) => {
      const s = faces(start(), [1, 1, 6, 4, 1]);
      s.run.looseGold = gold;
      s.run.bankedGold = 100;
      expect(() => action(s, "elora", "heal", "kael")).toThrow();
      expect(s.run.looseGold).toBe(gold);
      s.run.party[0].hp = 1;
      const r = action(s, "elora", "heal", "kael").state;
      expect(r.run.looseGold).toBe(Math.max(0, gold - 10));
      expect(r.run.bankedGold).toBe(100);
      expect(r.run.party[0].hp).toBe(3);
    },
  );
  it("rejects full, dead, unrolled, unfixed, sealed and spent actions without mutation", () => {
    const s = faces(start(), [6, 1, 1, 4, 1]);
    for (const field of ["loaded", "sealed", "spent"] as const) {
      const c = structuredClone(s);
      c.encounter.dice[0][field] = field !== "loaded";
      const before = JSON.stringify(c);
      expect(() =>
        action(c, "kael", "attack", c.encounter.enemies[0].id),
      ).toThrow();
      expect(JSON.stringify(c)).toBe(before);
    }
  });
});

describe("Marietta actions and encounter boundaries", () => {
  it("cleave snapshots its living neighbour, removes killed identities and awards once; undo restores all", () => {
    const s = faces(start(withMari), [1, 1, 1, 1, 1]);
    s.encounter.enemies[1].hp = 2;
    s.encounter.enemies[2].hp = 1;
    const ids = s.encounter.formation,
      result = action(s, "marietta", "attack", ids[1]);
    expect(result.state.encounter.formation).toEqual([ids[0]]);
    expect(result.state.run.looseGold).toBe(16);
    expect(
      result.events.filter((e) => e.type === "enemy-defeated"),
    ).toHaveLength(2);
    const undo = engine.dispatch(result.state, { type: "undo" }).state;
    expect(undo.encounter).toEqual(s.encounter);
    expect(undo.run.rng).toEqual(s.run.rng);
    expect(undo.run.looseGold).toBe(0);
    expect(
      action(s, "marietta", "attack", ids[2]).events.filter(
        (e) => e.type === "damage-applied",
      ),
    ).toHaveLength(1);
  });
  it("bind checks strict half HP and cap6; escaped target may be threaded again but not stunned", () => {
    const s = faces(start(withMari), [1, 1, 1, 1, 3]);
    const [a, b, c] = s.encounter.enemies;
    a.hp = b.hp = 6;
    c.hp = 7;
    expect(() => action(s, "marietta", "bind", a.id)).toThrow();
    expect(() => action(s, "marietta", "bind", c.id)).toThrow();
    let r = action(s, "marietta", "bind", b.id).state;
    expect(r.encounter.enemies[1]).toMatchObject({
      threaded: true,
      escaped: true,
      boundRound: 1,
    });
    r.encounter.enemies[1].boundRound = null;
    r.encounter.dice[4].spent = false;
    expect(
      action(r, "marietta", "bind", b.id).state.encounter.enemies[1].boundRound,
    ).toBeNull();
  });
  it("thread strike consumes only its target line and guard-all adds two to each published attack", () => {
    const s = faces(start(withMari), [1, 1, 1, 1, 6]);
    s.encounter.enemies[0].threaded = true;
    s.encounter.enemies[1].threaded = true;
    const r = action(s, "marietta", "attack", s.encounter.enemies[0].id).state;
    expect(r.encounter.enemies[0].hp).toBe(6);
    expect(r.encounter.enemies[0].threaded).toBe(false);
    expect(r.encounter.enemies[1].threaded).toBe(true);
    s.encounter.dice[4].faceIndex = 4;
    s.encounter.enemies[1].intent = {
      kind: "attack",
      value: 3,
      targetId: "kael",
      blocked: 0,
    };
    const guard = action(s, "marietta", "guard-all", null).state;
    expect(
      guard.encounter.enemies.slice(0, 2).map((e) => e.intent!.blocked),
    ).toEqual([2, 2]);
  });
  it("closing is atomic and reload deterministic; formation reorder never changes the persisted enemy queue", () => {
    const s = faces(start(withMari), [1, 1, 1, 1, 3]);
    s.encounter.enemies[1].hp = 3;
    s.encounter.enemies[1].chargeReady = true;
    const bound = action(
      s,
      "marietta",
      "bind",
      s.encounter.enemies[1].id,
    ).state;
    const closed = engine.dispatch(bound, { type: "end-turn" });
    expect(
      engine.dispatch(JSON.parse(JSON.stringify(bound)), { type: "end-turn" }),
    ).toEqual(closed);
    expect(() => engine.dispatch(closed.state, { type: "end-turn" })).toThrow();
    let moved = engine.reorder(
      closed.state,
      [...closed.state.encounter.formation].reverse(),
    );
    expect(moved.encounter.enemyOrder).toEqual(
      closed.state.encounter.enemyOrder,
    );
    for (let i = 0; i < 2; i++)
      moved = engine.dispatch(moved, { type: "resolve-next-enemy" }).state;
    expect(moved.encounter.cursor).toBe(2);
    expect(moved.encounter.enemies[1].chargeReady).toBe(true);
    expect(
      engine.dispatch(JSON.parse(JSON.stringify(moved)), {
        type: "resolve-next-enemy",
      }),
    ).toEqual(engine.dispatch(moved, { type: "resolve-next-enemy" }));
  });
  it("last kill locks extra player inputs; next encounter and next layer have different recovery rules", () => {
    let s = faces(start(), [1, 1, 1, 6, 1]);
    const ctx = { state: s, events: [] as DemoEvent[] };
    damageMember(catalog.data, ctx, "elora", 3, s.encounter.enemies[0].id);
    expect(s.run.party[2].temporaryRust).toEqual(["face.elora.01"]);
    expect(s.encounter.guardBonusIds).toContain("kael");
    const win = (state: DemoBattleState) => {
      state.encounter.enemies.forEach((e) => {
        e.hp = 0;
        e.intent = null;
        e.threaded = false;
        e.boundRound = null;
      });
      state.encounter.formation = [];
      expect(() => engine.dispatch(state, { type: "reroll" })).toThrow();
      return engine.dispatch(state, { type: "end-turn" });
    };
    const closed = win(s);
    expect(closed.events.map((e) => e.type)).toContain("encounter-completed");
    expect(closed.events.map((e) => e.type)).not.toContain("layer-cleared");
    s = engine.continueRoute(closed.state).state;
    expect([
      s.run.layer,
      s.run.room,
      s.run.party[2].hp,
      s.run.party[2].rainyReturn,
    ]).toEqual([1, 1, 1, true]);
    s = engine.continueRoute(win(faces(s, [1, 1, 1, 6, 1])).state).state;
    expect([
      s.run.layer,
      s.run.room,
      s.run.party[2].hp,
      s.run.party[2].rainyReturn,
    ]).toEqual([2, 0, 2, false]);
    expect(s.run.party[2].temporaryRust).toEqual(["face.elora.01"]);
    expect(new Set(s.run.completedEncounterIds).size).toBe(2);
    expect(s.run.settledLayers).toEqual([]);
  });
});

describe("independent hand patterns and covenant resolution", () => {
  // Synthetic awake faces isolate the hand truth table; production tables are covered above.
  const handCatalog = demoFixture((c) =>
    Object.values(c.characters).forEach((ch) =>
      ch.faces.forEach((f) => {
        f.fate = "awake";
        f.quality = "plain";
        f.rust = "none";
      }),
    ),
  );
  it.each([
    ["1112", true, false],
    ["1122", false, true],
    ["11122", true, true],
    ["1111", true, true],
    ["11112", true, true],
    ["11111", true, true],
  ] as const)(
    "%s independently detects triples and broad two-pair",
    (text, triple, twoPair) => {
      const e = createDemoBattleEngine(handCatalog),
        s = e.create({
          runId: "patterns",
          routeId: "test.route",
          progress: demoProgress(),
          partyIds: heroes.slice(0, text.length),
          seed: 0,
        });
      faces(s, [...text].map(Number));
      const hand = evaluateDemoHand(handCatalog.data, s);
      expect(hand.patterns).toMatchObject({ triple, twoPair });
    },
  );
  it("solves sole wild once, prefers quality contributors, preserves zero-bonus snapshot", () => {
    const s = faces(start(), [6, 1, 1, 4, 1]),
      hand = evaluateDemoHand(catalog.data, s);
    expect(hand.wildValue).toBe(1);
    expect(hand.patterns).toMatchObject({ triple: true, twoPair: true });
    const zero = faces(start(), [1, 1, 1, 1, 3]);
    zero.run.party[1].temporaryRust = ["face.eustice.01"];
    zero.run.party[2].temporaryRust = ["face.elora.01"];
    const h = evaluateDemoHand(catalog.data, zero);
    expect(h.adjustedBonus).toBe(0);
    expect(h.patterns.triple).toBe(true);
    expect(h.hasBlank).toBe(true);
    zero.run.party[0].hp = 2;
    const r = engine.dispatch(zero, { type: "end-turn" });
    expect(
      r.events.some(
        (e) => e.type === "covenant-triggered" && e.actorId === "elora",
      ),
    ).toBe(true);
  });
  it("flush requires four native suits, chooses four quality contributors and not a straight flush", () => {
    const c = demoFixture((c) => {
      Object.values(c.characters).forEach((ch) => {
        ch.suits = ["earth"];
        ch.faces.forEach((f) => (f.suit = "earth"));
      });
    });
    const e = createDemoBattleEngine(c),
      s = faces(
        e.create({
          runId: "flush",
          routeId: "test.route",
          progress: demoProgress(2),
          partyIds: heroes,
          seed: 0,
        }),
        [1, 2, 3, 4, 6],
      );
    const h = evaluateDemoHand(c.data, s);
    expect(h.name).toBe("同花");
    expect(h.contributors).not.toContain("kael");
    expect(h.patterns.straight).toBe(true);
  });
  const all: DemoHand["patterns"] = {
    flush: true,
    triple: true,
    twoPair: true,
    straight: true,
    fullHouse: false,
  };
  it("all 7776 initial face combinations have stable eligible contributors and a single legal wild assignment", () => {
    const s = start();
    for (let n = 0; n < 7776; n++) {
      let value = n;
      const slots: number[] = [];
      for (let i = 0; i < 5; i++) {
        slots.push((value % 6) + 1);
        value = Math.floor(value / 6);
      }
      faces(s, slots);
      const h = evaluateDemoHand(catalog.data, s);
      if (h.contributors.some((id) => !h.dice.some((d) => d.ownerId === id)))
        throw new Error(`invalid contributors at ${n}`);
      if ((h.wildValue !== null) !== (slots[0] === 6))
        throw new Error(`invalid wild at ${n}`);
      if (h.dice.some((d) => d.ownerId === "norma" && d.value !== slots[4]))
        throw new Error(`Norma pip changed at ${n}`);
      expect(evaluateDemoHand(catalog.data, s)).toEqual(h);
    }
  });
  it("stage2 random ranges reach both ends, execution never repeats a target, empty enemy set consumes no damage RNG", () => {
    const ranges = {
      eustice: new Set<number>(),
      kororo: new Set<number>(),
      norma: new Set<number>(),
    };
    for (let seed = 0; seed < 64; seed++) {
      const s = faces(
        engine.create({
          runId: "range",
          routeId: "test.route",
          partyIds: heroes,
          progress: demoProgress(3),
          seed,
        }),
        [1, 1, 1, 1, 3],
      );
      s.encounter.hand = {
        ...evaluateDemoHand(catalog.data, s),
        patterns: all,
      };
      const ctx = { state: s, events: [] as DemoEvent[] };
      resolveDemoCovenants(catalog.data, ctx);
      const hits = (actor: string) =>
        ctx.events.filter(
          (e) => e.type === "damage-applied" && e.actorId === actor,
        );
      ranges.eustice.add((hits("eustice")[0].payload as any).applied);
      ranges.kororo.add(hits("kororo").length);
      ranges.norma.add(hits("norma").length);
    }
    expect([...ranges.eustice].sort()).toEqual([2, 3, 4]);
    expect([...ranges.kororo].sort()).toEqual([1, 2]);
    expect([...ranges.norma].sort()).toEqual([2, 3]);
    const s = faces(start(heroes, 3), [1, 1, 1, 1, 3]);
    s.encounter.formation = [];
    s.encounter.hand = { ...evaluateDemoHand(catalog.data, s), patterns: all };
    const before = structuredClone(s.run.rng);
    resolveDemoCovenants(catalog.data, { state: s, events: [] });
    expect(s.run.rng).toEqual(before);
  });
  it.each([1, 3] as const)(
    "all four stage for Lv%i use frozen eligibility, bounded random effects, distinct execution targets and deterministic replay",
    (level) => {
      const s = faces(start(heroes, level), [1, 1, 1, 1, 3]);
      s.run.party[0].hp = 1;
      s.run.party[2].hp = 2;
      s.encounter.enemies.forEach((e) => (e.hp = 10));
      s.encounter.hand = {
        ...evaluateDemoHand(catalog.data, s),
        patterns: all,
      };
      const run = (state: DemoBattleState) => {
        const ctx = {
          state: structuredClone(state),
          events: [] as DemoEvent[],
        };
        resolveDemoCovenants(catalog.data, ctx);
        return ctx;
      };
      const a = run(s);
      expect(run(s)).toEqual(a);
      expect(
        a.events
          .filter((e) => e.type === "covenant-triggered")
          .map((e) => [e.actorId, (e.payload as any).stage]),
      ).toEqual([
        ["eustice", level === 3 ? 2 : 1],
        ["kororo", level === 3 ? 2 : 1],
        ["norma", level === 3 ? 2 : 1],
        ["elora", level === 3 ? 2 : 1],
      ]);
      const hits = a.events.filter(
        (e) => e.type === "damage-applied" && e.actorId === "kororo",
      );
      expect(new Set(hits.map((e) => (e.payload as any).targetId)).size).toBe(
        hits.length,
      );
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.length).toBeLessThanOrEqual(level === 3 ? 2 : 1);
      const knives = a.events.filter(
        (e) => e.type === "damage-applied" && e.actorId === "norma",
      );
      expect(knives.length).toBeGreaterThanOrEqual(level === 3 ? 2 : 1);
      expect(knives.length).toBeLessThanOrEqual(level === 3 ? 3 : 2);
    },
  );
  it("current healing cleanses full-health lowest ally without drawing; cannot clean temporary rust or retroactively trigger another covenant", () => {
    const s = faces(start(heroes, 3), [1, 1, 1, 1, 3]);
    s.encounter.dice[0].sealed = true;
    s.run.party[0].temporaryRust = ["face.kael.02"];
    s.encounter.hand = {
      ...evaluateDemoHand(catalog.data, s),
      patterns: { ...all, flush: false, twoPair: false, straight: false },
      covenantOwnerIds: ["elora"],
    };
    const rng = structuredClone(s.run.rng),
      ctx = { state: s, events: [] as DemoEvent[] };
    resolveDemoCovenants(catalog.data, ctx);
    expect(s.encounter.dice[0].sealed).toBe(false);
    expect(s.run.party[0].temporaryRust).toEqual(["face.kael.02"]);
    expect(s.run.rng).toEqual(rng);
    expect(
      ctx.events.filter((e) => e.type === "covenant-triggered"),
    ).toHaveLength(1);
  });
});
