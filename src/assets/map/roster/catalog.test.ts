import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { characterIdentities } from "../../../content/characters/identities";
import { partyFigureCatalogById } from "../party-figures/catalog";
import { rosterCardField, rosterCards } from "./catalog";

describe("roster card catalog", () => {
  /* 色场按阵营的纸来印：羊皮纸上是正片叠底的墨，染色纸上是不透明的颜料。
     档案改了某人的阵营而色场没有重印，牌面就会印错纸。 */
  it("prints every archive character's field for the sheet of their own faction", () => {
    for (const identity of characterIdentities) {
      const card = (rosterCards as Record<string, { faction: string; field: string }>)[identity.id];
      expect(card, identity.id).toBeDefined();
      expect(card!.faction, identity.id).toBe(identity.status.affiliation?.tone);
      expect(card!.field).toMatch(new RegExp(`field-${identity.id}\\.webp(?:\\?.*)?$`));
    }
    expect(Object.keys(rosterCards).sort()).toEqual(characterIdentities.map((identity) => identity.id).sort());
  });

  /* 生成脚本里同样登记了一份「谁印在哪张纸上」，两边不能各说各话。 */
  it("agrees with the generator about whose card goes on which sheet", () => {
    const script = readFileSync(resolve(import.meta.dirname, "../../../../scripts/prepare-map-dossier.py"), "utf8");
    const block = script.match(/CARDS = \{([\s\S]*?)\n\}/)?.[1] ?? "";
    const baked = Object.fromEntries([...block.matchAll(/"([a-z]+)": "([a-z-]+)"/g)].map(([, id, faction]) => [id, faction]));
    expect(baked).toEqual(Object.fromEntries(Object.entries(rosterCards).map(([id, card]) => [id, card.faction])));
  });

  /* 牌顶的立牌就是地图上那枚队伍立牌：有牌的人必须也在队伍立绘的名册里，
     否则入队时牌上弹不出人，地图上也站不出这个人。 */
  it("has a party standee for everyone who has a card", () => {
    for (const id of Object.keys(rosterCards)) expect(partyFigureCatalogById, id).toHaveProperty(id);
  });

  it("prints nothing for someone without a card", () => {
    expect(rosterCardField("kael")).toBeUndefined();
    expect(rosterCardField("eustice")).toBe(rosterCards.eustice.field);
  });
});
