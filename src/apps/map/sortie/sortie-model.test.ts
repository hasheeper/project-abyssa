import { describe, expect, it } from "vitest";
import type { DieFace, DieSuit } from "../../../shared/domain/dice/face";
import {
  EMPTY_SORTIE_PARTY,
  SORTIE_ORDER_STORAGE_KEY,
  SORTIE_SLOT_COUNT,
  buildSortieOrder,
  canDepart,
  composeParty,
  countDice,
  describeGamble,
  explainSortieOrderRejection,
  inferPrimarySuit,
  isMemberAvailable,
  reconcileParty,
  saveSortieOrder,
  setCommandMode,
  toggleMember,
  toggleRosterMember
} from "./sortie-model";
import type { SortieMember, SortieParty } from "./sortie-model";
import type { MapLocationId } from "../types";

function die(
  primary: DieSuit,
  secondary: DieSuit,
  spec: Array<[DieFace["action"], DieFace["fate"]]>
): DieFace[] {
  return spec.map(([action, fate], index) => ({
    face: (index + 1) as DieFace["face"],
    pip: index + 1,
    action,
    power: action === "blank" ? 0 : 2,
    fate,
    suit: index < 4 ? primary : secondary
  }));
}

const squadDie = die("holy", "earth", [
  ["attack", "awake"],
  ["attack", "awake"],
  ["guard", "awake"],
  ["heal", "awake"],
  ["blank", "awake"],
  ["blank", "asleep"]
]);

const heavyDie = die("abyss", "beyond", [
  ["attack", "asleep"],
  ["attack", "awake"],
  ["guard", "asleep"],
  ["attack", "awake"],
  ["heal", "awake"],
  ["guard", "asleep"]
]);

describe("sortie party slots", () => {
  it("adds members in order, removes on second toggle and refuses a fifth", () => {
    let party = EMPTY_SORTIE_PARTY;
    for (const id of ["a", "b", "c", "d"]) party = toggleMember(party, id);
    expect(party.memberIds).toEqual(["a", "b", "c", "d"]);
    expect(party.memberIds).toHaveLength(SORTIE_SLOT_COUNT);

    const refused = toggleMember(party, "e");
    expect(refused).toBe(party);

    const removed = toggleMember(party, "b");
    expect(removed.memberIds).toEqual(["a", "c", "d"]);
  });

  it("counts the fifth die only under personal command and gates departure on members", () => {
    const empty = EMPTY_SORTIE_PARTY;
    expect(canDepart(empty)).toBe(false);
    expect(countDice(empty)).toBe(1);

    const solo = toggleMember(empty, "a");
    expect(canDepart(solo)).toBe(true);
    expect(countDice(solo)).toBe(2);

    const delegated = setCommandMode(solo, "delegate");
    expect(countDice(delegated)).toBe(1);
    expect(setCommandMode(delegated, "delegate")).toBe(delegated);
  });

  it("treats injured members and members without faces as unavailable", () => {
    const base: SortieMember = {
      id: "x",
      name: "X",
      shortName: "X",
      title: "T",
      faction: "hero-party",
      factionLabel: "勇者小队",
      faces: squadDie,
      boardingLine: "走。"
    };
    expect(isMemberAvailable(base)).toBe(true);
    expect(isMemberAvailable({ ...base, absence: { kind: "injury", reason: "轻伤休养" } })).toBe(false);
    expect(isMemberAvailable({ ...base, faces: [] })).toBe(false);
  });
});

/* 编入预览与真正出发是两道关：真实名单里谁都能上台查看，
   但伤势与缺骰面仍必须在写出击令前被规则层拦住。 */
describe("roster-aware enlistment", () => {
  const member = (id: string, overrides: Partial<SortieMember> = {}): SortieMember => ({
    id,
    name: id,
    shortName: id,
    title: "T",
    faction: "hero-party",
    factionLabel: "勇者小队",
    faces: squadDie,
    boardingLine: "走。",
    ...overrides
  });

  const roster: SortieMember[] = [
    member("ready"),
    member("hurt", { absence: { kind: "injury", reason: "轻伤休养" } }),
    member("faceless", { faces: [] })
  ];

  it("lets every known member enter the preview party and still rejects unknown ids", () => {
    expect(toggleRosterMember(roster, EMPTY_SORTIE_PARTY, "ready").memberIds).toEqual(["ready"]);
    expect(toggleRosterMember(roster, EMPTY_SORTIE_PARTY, "ghost").memberIds).toEqual([]);
    expect(toggleRosterMember(roster, EMPTY_SORTIE_PARTY, "hurt").memberIds).toEqual(["hurt"]);
    expect(toggleRosterMember(roster, EMPTY_SORTIE_PARTY, "faceless").memberIds).toEqual(["faceless"]);

    /* 伤势成员也必须能退出，不能锁死在预览队伍里。 */
    const stuck: SortieParty = { memberIds: ["hurt"], command: "personal" };
    expect(toggleRosterMember(roster, stuck, "hurt").memberIds).toEqual([]);
  });

  it("keeps known preview members and drops only ids that left the roster", () => {
    const party: SortieParty = { memberIds: ["ready", "hurt", "ghost"], command: "personal" };
    expect(reconcileParty(roster, party).memberIds).toEqual(["ready", "hurt"]);

    const clean: SortieParty = { memberIds: ["ready"], command: "personal" };
    expect(reconcileParty(roster, clean)).toBe(clean);
  });

  it("names why an order cannot leave, and stays silent when it can", () => {
    const nodes: MapLocationId[] = ["cave", "tower"];
    const ok: SortieParty = { memberIds: ["ready"], command: "personal" };

    expect(explainSortieOrderRejection(roster, nodes, "cave", ok)).toBeNull();
    expect(explainSortieOrderRejection(roster, nodes, "church", ok)).toContain("未知");
    expect(explainSortieOrderRejection(roster, nodes, "cave", EMPTY_SORTIE_PARTY)).toContain("至少");
    expect(
      explainSortieOrderRejection(roster, nodes, "cave", { memberIds: ["ready", "ready"], command: "personal" })
    ).toContain("重复");
    expect(
      explainSortieOrderRejection(roster, nodes, "cave", { memberIds: ["ghost"], command: "personal" })
    ).toContain("查无此人");
    expect(
      explainSortieOrderRejection(roster, nodes, "cave", { memberIds: ["hurt"], command: "personal" })
    ).toContain("出不了门");
    expect(
      explainSortieOrderRejection(roster, nodes, "cave", { memberIds: ["faceless"], command: "personal" })
    ).toContain("出不了门");
    expect(
      explainSortieOrderRejection(roster, nodes, "cave", {
        memberIds: ["a", "b", "c", "d", "e"],
        command: "personal"
      })
    ).toContain(`${SORTIE_SLOT_COUNT} 人`);
  });
});

describe("composeParty", () => {
  it("aggregates faces, fates and suits across dice", () => {
    const composition = composeParty([
      { faces: squadDie, primarySuit: "holy", faction: "hero-party" },
      { faces: heavyDie, primarySuit: "abyss", faction: "demon-cadre" }
    ]);

    expect(composition.diceCount).toBe(2);
    expect(composition.face).toEqual({ attack: 5, guard: 3, heal: 2, other: 0, blank: 2, total: 12 });
    expect(composition.fate).toEqual({ awake: 8, asleep: 4, total: 12 });
    expect(composition.suits.map((entry) => [entry.suit, entry.faces, entry.primaryDice])).toEqual([
      ["holy", 4, 1],
      ["earth", 2, 0],
      ["abyss", 4, 1],
      ["beyond", 2, 0]
    ]);
    expect(composition.factions).toEqual({ "hero-party": 1, "demon-cadre": 1, "demon-lord": 0 });
    // 主色骰数并列时取面数多者，再并列取先出现者。
    expect(composition.dominantSuit?.suit).toBe("holy");
  });

  it("infers the primary suit from the four-face majority when not declared", () => {
    expect(inferPrimarySuit(heavyDie)).toBe("abyss");
    expect(inferPrimarySuit([])).toBeUndefined();
    const composition = composeParty([{ faces: heavyDie }]);
    expect(composition.suits.find((entry) => entry.suit === "abyss")?.primaryDice).toBe(1);
  });
});

describe("describeGamble", () => {
  it("names the empty, squad-only, heavy-only and mixed shapes without numbers or ratings", () => {
    expect(describeGamble(composeParty([]))).toContain("还没人上车");

    const squad = describeGamble(composeParty([
      { faces: squadDie, faction: "hero-party" },
      { faces: squadDie, faction: "hero-party" }
    ]));
    expect(squad).toContain("全员小队骰");
    expect(squad).toContain("手忙脚乱");

    const heavy = describeGamble(composeParty([
      { faces: heavyDie, faction: "demon-cadre" },
      { faces: heavyDie, faction: "demon-lord" }
    ]));
    expect(heavy).toContain("全员天王骰");

    const mixed = describeGamble(composeParty([
      { faces: squadDie, faction: "hero-party" },
      { faces: heavyDie, faction: "demon-cadre" }
    ]));
    expect(mixed).toContain("带了一位天王");

    for (const text of [squad, heavy, mixed]) {
      expect(text).not.toMatch(/难度|胜率|★|%/);
    }
  });

  it("mentions the dominant suit once three dice share it as primary", () => {
    const text = describeGamble(composeParty([
      { faces: squadDie, primarySuit: "holy", faction: "hero-party" },
      { faces: squadDie, primarySuit: "holy", faction: "hero-party" },
      { faces: squadDie, primarySuit: "holy", faction: "hero-party" }
    ]));
    expect(text).toContain("圣辉3骰同色");
    expect(text.length).toBeLessThanOrEqual(24);
  });
});

describe("sortie order", () => {
  it("serialises the chosen node, members and command into session storage", () => {
    const party = setCommandMode(toggleMember(toggleMember(EMPTY_SORTIE_PARTY, "eustice"), "lenore"), "delegate");
    const order = buildSortieOrder("cave", party, 1_700_000_000_000);
    expect(order).toEqual({
      version: 1,
      nodeId: "cave",
      memberIds: ["eustice", "lenore"],
      command: "delegate",
      diceCount: 2,
      issuedAt: 1_700_000_000_000
    });

    const store = new Map<string, string>();
    saveSortieOrder({ setItem: (key, value) => void store.set(key, value) }, order);
    expect(JSON.parse(store.get(SORTIE_ORDER_STORAGE_KEY)!)).toEqual(order);
  });
});
