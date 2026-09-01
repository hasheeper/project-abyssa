import { describe, expect, it } from "vitest";
import { CHARACTERS, PARTY_ORDER } from "../engine";
import { actScenario } from "../testing/scenario";
import {
  INTENT_VIEW_WIDTH,
  buildDieFaces,
  enemyAnchorX,
  getEnemyTargetCommand,
  getMemberTargetCommand,
  partyAnchorX
} from "./battle-view-model";

describe("expedition battle view model", () => {
  it("maps all engine faces into rust-aware presentation faces", () => {
    const faces = buildDieFaces("kael", 1);

    expect(faces).toHaveLength(CHARACTERS.kael.faces.length);
    expect(faces.map(({ verb, power, wildPip }) => ({ verb, power, wildPip }))).toEqual(
      CHARACTERS.kael.faces.map(({ verb, power, wildPip }) => ({ verb, power, wildPip }))
    );
    expect(faces.filter((face) => face.quality === "rust")).toHaveLength(1);
  });

  it("uses stable intent and party anchors", () => {
    expect(enemyAnchorX(0, 2)).toBe(INTENT_VIEW_WIDTH / 4);
    expect(enemyAnchorX(1, 2)).toBe(INTENT_VIEW_WIDTH * 0.75);
    const partyAnchors = PARTY_ORDER.map(partyAnchorX);
    [146.4, 333.2, 520, 706.8, 893.6].forEach((anchor, index) => {
      expect(partyAnchors[index]).toBeCloseTo(anchor);
    });
  });

  it("projects healing and enemy attack faces into target commands", () => {
    const healing = actScenario(7).face("elora", { verb: "heal" }).build();
    expect(getMemberTargetCommand(healing, "elora", "kael")).toEqual({
      type: "heal-member",
      actorId: "elora",
      targetId: "kael"
    });

    const attacking = actScenario(11).face("eustice", { verb: "attack" }).build();
    const enemyId = attacking.enemies[0]!.id;
    expect(getEnemyTargetCommand(attacking, "eustice", enemyId)).toEqual({
      type: "attack-enemy",
      actorId: "eustice",
      enemyId
    });
  });
});
