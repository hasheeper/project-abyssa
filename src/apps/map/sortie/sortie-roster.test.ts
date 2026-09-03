import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCalibration } from "../../../shared/ui/patterns/spriteCalibration";
import { characterProfiles } from "../../../content/characters/profiles";
import { findDiceLoadout } from "../../../content/characters/diceLoadouts";
import { EMPTY_SORTIE_PARTY, isMemberAvailable, toggleRosterMember } from "./sortie-model";
import { sortieLeader, sortieRoster } from "./sortie-roster";

/* 名单是适配器，不是数据源。这些测试盯的是「有没有人在这里偷偷新编设定」。 */

describe("sortie roster", () => {
  it("mirrors the character archive one-for-one, in the same order", () => {
    expect(sortieRoster.map((member) => member.id)).toEqual(
      characterProfiles.map((profile) => profile.id)
    );
  });

  it("gives every archive member dedicated art for the party stage", () => {
    expect(sortieRoster).toHaveLength(9);
    sortieRoster.forEach((member) => {
      expect(member.figureUrl, member.id).toMatch(/party-figures/);
      expect(member.figureUrl, member.id).not.toBe(member.portraitUrl);
    });
  });

  it("resolves party art through the shared catalog", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./sortie-roster.ts"), "utf8");

    expect(source).toContain("partyFigureCatalogById");
    expect(source).not.toMatch(/party-figures\/[a-z-]+\.png/);
  });

  it("takes faces from the dice loadouts rather than inventing them", () => {
    sortieRoster.forEach((member) => {
      const loadout = findDiceLoadout(member.id);
      expect(member.faces).toEqual(loadout?.faces ?? []);
      expect(member.primarySuit).toBe(loadout?.primarySuit);
    });
  });

  /* 花色词表必须与骰面契约同源。骨架稿里写的是 mortal，
     契约里是 earth —— 名单若两边各写一份，同花判定会静默错位。 */
  it("only uses suits from the shared dice contract", () => {
    const allowed = new Set(["holy", "earth", "abyss", "beyond"]);
    sortieRoster.forEach((member) => {
      member.faces.forEach((face) => expect(allowed.has(face.suit)).toBe(true));
      if (member.primarySuit) expect(allowed.has(member.primarySuit)).toBe(true);
    });
  });

  /* 状态仍从档案读取，但不再锁住编队预览；只锁最后出发。 */
  it("keeps archive absence as departure readiness instead of a preview lock", () => {
    const lenore = sortieRoster.find((member) => member.id === "lenore");
    expect(lenore?.absence?.reason).toBe("轻伤休养");
    expect(isMemberAvailable(lenore!)).toBe(false);
    expect(toggleRosterMember(sortieRoster, EMPTY_SORTIE_PARTY, "lenore").memberIds).toEqual([
      "lenore"
    ]);

    const chips = characterProfiles.find((profile) => profile.id === "lenore")?.status.statusChips;
    expect(chips?.some((chip) => chip.tone === "danger")).toBe(true);
  });

  it("keeps members without dice available for preview while departure stays incomplete", () => {
    const dieless = sortieRoster.filter((member) => member.faces.length === 0);
    expect(dieless.length).toBeGreaterThan(0);
    dieless.forEach((member) => {
      expect(isMemberAvailable(member)).toBe(false);
      expect(toggleRosterMember(sortieRoster, EMPTY_SORTIE_PARTY, member.id).memberIds).toEqual([
        member.id
      ]);
      /* 占位不是缺数据，是正当状态：得说得出为什么没有骰面。 */
      expect(member.placeholderNote).toBeTruthy();
    });
  });

  it("keeps the faction vocabulary aligned with the archive tones", () => {
    const allowed = new Set(["hero-party", "demon-cadre", "demon-lord"]);
    sortieRoster.forEach((member) => {
      expect(allowed.has(member.faction)).toBe(true);
      expect(member.factionLabel).toBeTruthy();
    });
  });

  /* 凯尔没有角色档案（他是玩家位），也还没有骰装。
     这里断言的是「缺口如实存在」，不是「缺口已被填上」。 */
  it("keeps the leader outside the archive and without dice for now", () => {
    expect(sortieRoster.some((member) => member.id === "kael")).toBe(false);
    expect(sortieLeader.id).toBe("kael");
    expect(sortieLeader.faces).toEqual([]);
    expect(sortieLeader.figureUrl).toMatch(/party-figures/);
    expect(sortieLeader.figureUrl).not.toBe(sortieLeader.portraitUrl);
  });

  /* 上车台词尚未撰写。空字符串是诚实的缺口；
     若有人填了占位台词，会被当成已定稿的角色声音。 */
  it("does not fabricate boarding lines", () => {
    sortieRoster.forEach((member) => expect(member.boardingLine).toBe(""));
  });

  /* 立绘取景必须沿用 RP 那套已调好的逐角色校准，不许另调一份 ——
     同一个人在两处大小不一才是真的乱。
     九人在画布里身高差 11%（scale 0.860–0.955），不校准就头顶不齐。 */
  it("reuses the shared sprite calibration for every portrait", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "./SortieRosterPanel.tsx"),
      "utf8"
    );

    expect(source).toContain("spriteCalibration");
    expect(source).toContain("getCalibration");
    /* 不许在海报里另写一张校准表。 */
    expect(source).not.toMatch(/scale:\s*0\.\d+/);

    sortieRoster.forEach((member) => {
      if (!member.portraitUrl) return;
      const { scale } = getCalibration(member.id);
      expect(scale, member.id).toBeGreaterThan(0);
    });
  });

  it("keeps party-stage figures out of the poster and quest renderers", () => {
    const stageSource = readFileSync(
      resolve(import.meta.dirname, "./SortiePartyStage.tsx"),
      "utf8"
    );
    const posterSource = readFileSync(
      resolve(import.meta.dirname, "./SortieRosterPanel.tsx"),
      "utf8"
    );
    const questSource = readFileSync(
      resolve(import.meta.dirname, "./SortieQuestPanel.tsx"),
      "utf8"
    );

    expect(stageSource).toContain("member.figureUrl ?? member.portraitUrl");
    expect(stageSource).toContain("partyFigureCalibrations[characterId as PartyFigureId]");
    expect(stageSource).toContain('"--sortie-figure-scale"');
    expect(stageSource).toContain('"--sortie-figure-x"');
    expect(stageSource).toContain('"--sortie-figure-y"');
    expect(stageSource).toContain('"--sortie-figure-flip-x"');
    expect(stageSource).toContain("partyFigureStyle(member.id)");
    expect(stageSource).toContain('data-art={leader.figureUrl ? "figure" : "portrait"}');
    expect(stageSource).toContain("leader.figureUrl ?? leader.portraitUrl");
    expect(stageSource).toContain("partyFigureStyle(leader.id)");
    expect(posterSource).toContain("<img src={member.portraitUrl}");
    expect(posterSource).not.toContain("member.figureUrl");
    expect(questSource).toContain("<img src={leader.portraitUrl}");
    expect(questSource).not.toContain("leader.figureUrl");
  });
});
