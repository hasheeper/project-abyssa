import { describe, expect, it } from "vitest";
import { getFace } from "../engine";
import { ExpeditionScenarioBuilder, actScenario } from "./scenario";

describe("ExpeditionScenarioBuilder", () => {
  it("creates deterministic rolled scenarios", () => {
    expect(actScenario(17).build()).toEqual(actScenario(17).build());
  });

  it("selects and loads a face without sharing later fixture edits", () => {
    const builder = actScenario(23).face("elora", { verb: "heal", power: 2 }, true);
    const first = builder.build();
    builder.party("elora", { hp: 1 });
    const second = builder.build();

    const die = first.dice.find((candidate) => candidate.ownerId === "elora")!;
    expect(getFace(die)).toMatchObject({ verb: "heal", power: 2 });
    expect(die.loaded).toBe(true);
    expect(first.party.find((member) => member.id === "elora")!.hp).toBe(3);
    expect(second.party.find((member) => member.id === "elora")!.hp).toBe(1);
  });

  it("patches enemies through an explicit fixture-only API", () => {
    const builder = ExpeditionScenarioBuilder.act(31);
    const enemyId = builder.enemyId(0);
    const state = builder.enemy(enemyId, { hp: 1 }).build();

    expect(state.enemies.find((enemy) => enemy.id === enemyId)!.hp).toBe(1);
  });
});
