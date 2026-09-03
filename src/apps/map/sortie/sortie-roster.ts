import kaelPortrait from "../../../assets/png/kael.png";
import { partyFigureCatalogById } from "../../../assets/map/party-figures/catalog";
import type { PartyFigureId } from "../../../content/characters/partyFigureCalibration";
import { characterProfiles } from "../../../content/characters/profiles";
import { findDiceLoadout } from "../../../content/characters/diceLoadouts";
import type { SortieAbsence, SortieFaction, SortieLeader, SortieMember } from "./sortie-model";

/* ============ 名单适配器 ============
 *
 * 为什么住在 app 而不是 content：
 *   content 只允许 import shared/domain（scripts/check-module-boundaries.mjs:80-85），
 *   而 SortieMember 是出击面板的私有契约，住在本目录。
 *   反过来 app 可以 import content —— 于是「档案 + 骰装 → 出击名单」这层
 *   拼装只能落在这里。content 保持纯数据，不认识出击这回事。
 *
 * 名单不是新数据源：
 *   人是谁、长什么样、属于哪一方，全部读 characterProfiles；
 *   六面骰读 characterDiceLoadouts。这里一个字段都不新编，
 *   否则同一个人会有两份互相打架的设定。
 *
 * 缺勤是读出来的，不是写死的：
 *   档案里 tone: "danger" 的状态签就是缺勤（蕾诺尔的「轻伤休养 2天」）。
 *   若改档案让她痊愈，名单会自动跟着放行，不需要动这个文件。 */

/** 档案的 affiliation.tone 与出击阵营同词表，直接透传。 */
type ProfileTone = SortieFaction;

const FACTION_FALLBACK: SortieFaction = "hero-party";

/** 地图队伍舞台专用的 Q 版立绘；海报名册仍读取档案的 portraitUrl。 */
function readPartyFigureUrl(characterId: string): string | undefined {
  return partyFigureCatalogById[characterId as PartyFigureId]?.url;
}

function readFaction(tone: string | undefined): SortieFaction {
  const known: ProfileTone[] = ["hero-party", "demon-cadre", "demon-lord"];
  return known.includes(tone as ProfileTone) ? (tone as ProfileTone) : FACTION_FALLBACK;
}

/** 状态签里 tone 为 danger 的那条即缺勤理由。 */
function readAbsence(chips: readonly { label: string; detail?: string; tone?: string }[] | undefined): SortieAbsence | undefined {
  const wounded = chips?.find((chip) => chip.tone === "danger");
  if (!wounded) return undefined;
  return { kind: "injury", reason: wounded.label, detail: wounded.detail };
}

export const sortieRoster: SortieMember[] = characterProfiles.map((profile) => {
  const loadout = findDiceLoadout(profile.id);
  const status = profile.status;
  return {
    id: profile.id,
    name: profile.name,
    secondaryName: profile.secondaryName,
    shortName: profile.selectorLabel ?? profile.name,
    title: status.title ?? "",
    faction: readFaction(status.affiliation?.tone),
    factionLabel: status.affiliation?.label ?? "",
    thumbnailUrl: profile.thumbnailUrl,
    portraitUrl: profile.portraitUrl,
    figureUrl: readPartyFigureUrl(profile.id),
    primarySuit: loadout?.primarySuit,
    secondarySuit: loadout?.secondarySuit,
    faces: loadout?.faces ?? [],
    pact: loadout?.pact,
    /* 上车台词尚未撰写。留空字符串而不是编一句占位台词 ——
       假台词会被当成已定稿的角色声音，比空着更难清理。 */
    boardingLine: "",
    absence: readAbsence(status.statusChips),
    placeholderNote: loadout?.placeholderNote
  };
});

/* 凯尔不在 characterProfiles 里：他是玩家位，没有可供检视的角色档案。
   这里只给出击面板需要的最小信息，不构成一份新档案。
   六面骰同样缺席 —— 第五骰的构成表要等他的骰装落进 content 才有。 */
export const sortieLeader: SortieLeader = {
  id: "kael",
  name: "凯尔",
  secondaryName: "KAEL",
  shortName: "凯尔",
  title: "无铭之勇者",
  portraitUrl: kaelPortrait,
  figureUrl: readPartyFigureUrl("kael"),
  faces: [],
  boardingLine: "",
  stayLine: "这趟我不去，家里留个人。"
};
