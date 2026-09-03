import type { DieFace, DieSuit } from "../../../shared/domain/dice/face";
import { DIE_SUIT_LABELS, fateEntersHand } from "../../../shared/domain/dice/face";
import type { MapLocationId } from "../types";

/* ============ 出击面板的纯规则 ============
 *
 * 这里只有可序列化的数据与纯函数，不碰 React、DOM 与 Three.js。
 * 面板要回答的四个问题里，「这套阵容是什么赌法」完全由本文件推导：
 * 把入队成员的六面骰聚合成战面 / 命数 / 花色三张构成表，再由构成表
 * 生成一句手账批注。**不产出难度等级、胜率或期望值** —— 那是设计护栏
 * (「编队即难度」必须让玩家自己从阵容里读出来，不能用数字替他读)。 */

/** 亲征 = 凯尔亲自带队，第五骰锁定；托管 = 四骰出门，凯尔留守。 */
export type SortieCommandMode = "personal" | "delegate";

export const SORTIE_COMMAND_LABELS: Record<SortieCommandMode, string> = {
  personal: "亲征",
  delegate: "托管"
};

/** 可选槽位数。凯尔的第五席不在其中，由 command 决定有无。 */
export const SORTIE_SLOT_COUNT = 4;

export type SortieFaction = "hero-party" | "demon-cadre" | "demon-lord";

export type SortieAbsenceKind = "injury" | "mood";

export interface SortieAbsence {
  kind: SortieAbsenceKind;
  /** 一句话理由，例如「轻伤休养」。 */
  reason: string;
  /** 附注，例如「还剩 2 天」。 */
  detail?: string;
}

export interface SortieMember {
  id: string;
  name: string;
  secondaryName?: string;
  /** 槽位与名单上用的短名。 */
  shortName: string;
  title: string;
  faction: SortieFaction;
  factionLabel: string;
  /** 头像，用于名单缩略与队伍槽位。 */
  thumbnailUrl?: string;
  /** 档案全身立绘，用于海报位，也是队伍舞台缺图时的回退。 */
  portraitUrl?: string;
  /** Q 版立绘，仅用于地图上的队伍舞台。 */
  figureUrl?: string;
  primarySuit?: DieSuit;
  secondarySuit?: DieSuit;
  /** 六面骰。空数组表示尚无骰面：可编入预览，但不能真正出发。 */
  faces: DieFace[];
  /** 私约一行摘要。 */
  pact?: string;
  /** 出发确认时的上车台词。 */
  boardingLine: string;
  /** 有值表示当前状态：仍可编入预览，但不能真正出发。 */
  absence?: SortieAbsence;
  /** 无骰面时的说明，例如「尚未编入远征队列」。 */
  placeholderNote?: string;
}

/** 凯尔不占四个可选槽，是第五席的常驻者。 */
export interface SortieLeader {
  id: "kael";
  name: string;
  secondaryName: string;
  shortName: string;
  title: string;
  /** 档案全身立绘，用于委托小槽，也是队伍舞台缺图时的回退。 */
  portraitUrl?: string;
  /** Q 版立绘，仅用于地图上的队伍舞台。 */
  figureUrl?: string;
  faces: DieFace[];
  pact?: string;
  boardingLine: string;
  /** 托管时留守的一句话。 */
  stayLine: string;
}

export interface SortieParty {
  /** 按入队顺序排列，长度 ≤ SORTIE_SLOT_COUNT。 */
  memberIds: string[];
  command: SortieCommandMode;
}

export const EMPTY_SORTIE_PARTY: SortieParty = { memberIds: [], command: "personal" };

export function isMemberAvailable(member: SortieMember): boolean {
  return !member.absence && member.faces.length > 0;
}

export function isPartyFull(party: SortieParty): boolean {
  return party.memberIds.length >= SORTIE_SLOT_COUNT;
}

/** 已入队则移出；未入队且有空槽则加入；满员时原样返回（由 UI 提示）。
 *  低阶原语：只认 id，不判断成员是否存在。名单在手时请改用
 *  toggleRosterMember，让未知 id 仍被名单边界拦住。 */
export function toggleMember(party: SortieParty, memberId: string): SortieParty {
  if (party.memberIds.includes(memberId)) {
    return { ...party, memberIds: party.memberIds.filter((id) => id !== memberId) };
  }
  if (isPartyFull(party)) return party;
  return { ...party, memberIds: [...party.memberIds, memberId] };
}

export function findSortieMember(
  roster: readonly SortieMember[],
  memberId: string
): SortieMember | undefined {
  return roster.find((member) => member.id === memberId);
}

/** 名单感知的编队开关：真实名单内的角色都可加入/退出以预览舞台；
 *  伤势与缺骰面只在最后出发时拦截。未知 id 仍不能混入队伍。 */
export function toggleRosterMember(
  roster: readonly SortieMember[],
  party: SortieParty,
  memberId: string
): SortieParty {
  if (party.memberIds.includes(memberId)) return toggleMember(party, memberId);
  const member = findSortieMember(roster, memberId);
  if (!member) return party;
  return toggleMember(party, memberId);
}

/** 只剔除名单里已不存在的成员，保持预览队伍的原有顺序。 */
export function reconcileParty(
  roster: readonly SortieMember[],
  party: SortieParty
): SortieParty {
  const kept = party.memberIds.filter((id) => {
    const member = findSortieMember(roster, id);
    return Boolean(member);
  });
  return kept.length === party.memberIds.length ? party : { ...party, memberIds: kept };
}

export function setCommandMode(party: SortieParty, command: SortieCommandMode): SortieParty {
  return party.command === command ? party : { ...party, command };
}

/** 本趟掷出的骰子数：成员数 + 亲征的第五骰。 */
export function countDice(party: SortieParty): number {
  return party.memberIds.length + (party.command === "personal" ? 1 : 0);
}

/** 至少带一人才准出发；托管的空队等于没有远征。 */
export function canDepart(party: SortieParty): boolean {
  return party.memberIds.length > 0;
}

/* ============ 阵容聚合 ============ */

/** 战面构成。coin / art 归入 other，空面单列 —— 空面多寡即「手忙脚乱程度」。 */
export interface FaceComposition {
  attack: number;
  guard: number;
  heal: number;
  other: number;
  blank: number;
  total: number;
}

/** 命数构成。沉眠面不进牌局，等于「骰子上瞎掉的面」。 */
export interface FateComposition {
  awake: number;
  asleep: number;
  total: number;
}

export interface SuitCompositionEntry {
  suit: DieSuit;
  label: string;
  /** 全队该花色的面数。 */
  faces: number;
  /** 以该花色为主色（4 面）的骰子数 —— 同花可行性看它就够了。 */
  primaryDice: number;
}

export interface PartyComposition {
  diceCount: number;
  face: FaceComposition;
  fate: FateComposition;
  suits: SuitCompositionEntry[];
  /** 主色骰最多的花色；并列取面数多者，再并列取先出现者。 */
  dominantSuit: SuitCompositionEntry | null;
  factions: Record<SortieFaction, number>;
}

const SUIT_ORDER: DieSuit[] = ["holy", "earth", "abyss", "beyond"];

export interface PartyDieSource {
  faces: DieFace[];
  primarySuit?: DieSuit;
  faction?: SortieFaction;
}

export function composeParty(dice: readonly PartyDieSource[]): PartyComposition {
  const face: FaceComposition = { attack: 0, guard: 0, heal: 0, other: 0, blank: 0, total: 0 };
  const fate: FateComposition = { awake: 0, asleep: 0, total: 0 };
  const suitFaces = new Map<DieSuit, number>(SUIT_ORDER.map((suit) => [suit, 0]));
  const suitPrimary = new Map<DieSuit, number>(SUIT_ORDER.map((suit) => [suit, 0]));
  const factions: Record<SortieFaction, number> = { "hero-party": 0, "demon-cadre": 0, "demon-lord": 0 };

  dice.forEach((die) => {
    if (die.faction) factions[die.faction] += 1;
    const primary = die.primarySuit ?? inferPrimarySuit(die.faces);
    if (primary) suitPrimary.set(primary, (suitPrimary.get(primary) ?? 0) + 1);
    die.faces.forEach((entry) => {
      face.total += 1;
      fate.total += 1;
      if (entry.action === "attack") face.attack += 1;
      else if (entry.action === "guard") face.guard += 1;
      else if (entry.action === "heal") face.heal += 1;
      else if (entry.action === "blank") face.blank += 1;
      else face.other += 1;
      if (fateEntersHand(entry.fate)) fate.awake += 1;
      else fate.asleep += 1;
      suitFaces.set(entry.suit, (suitFaces.get(entry.suit) ?? 0) + 1);
    });
  });

  const suits = SUIT_ORDER.map<SuitCompositionEntry>((suit) => ({
    suit,
    label: DIE_SUIT_LABELS[suit],
    faces: suitFaces.get(suit) ?? 0,
    primaryDice: suitPrimary.get(suit) ?? 0
  }));
  const dominantSuit = suits.reduce<SuitCompositionEntry | null>((best, entry) => {
    if (entry.faces === 0) return best;
    if (!best) return entry;
    if (entry.primaryDice !== best.primaryDice) return entry.primaryDice > best.primaryDice ? entry : best;
    return entry.faces > best.faces ? entry : best;
  }, null);

  return { diceCount: dice.length, face, fate, suits, dominantSuit, factions };
}

/** 没标主色时按面数推：主色 4 面必然是众数。 */
export function inferPrimarySuit(faces: readonly DieFace[]): DieSuit | undefined {
  if (faces.length === 0) return undefined;
  const counts = new Map<DieSuit, number>();
  faces.forEach((face) => counts.set(face.suit, (counts.get(face.suit) ?? 0) + 1));
  let best: DieSuit | undefined;
  let bestCount = 0;
  counts.forEach((count, suit) => {
    if (count > bestCount) {
      best = suit;
      bestCount = count;
    }
  });
  return best;
}

/* ============ 手账批注 ============
 * 一句倾向性提示，不是评分。措辞跟着阵营构成与空面/沉眠占比走，
 * 让玩家「预感」赌局形状；精算会杀死贪心的乐趣，所以这里没有数字。 */
export function describeGamble(composition: PartyComposition): string {
  const members = composition.factions["hero-party"] + composition.factions["demon-cadre"] + composition.factions["demon-lord"];
  if (members === 0) return "还没人上车，先选队员。";

  const heroes = composition.factions["hero-party"];
  const heavies = composition.factions["demon-cadre"] + composition.factions["demon-lord"];
  let shape: string;
  if (heavies === 0) shape = "全员小队骰";
  else if (heroes === 0) shape = "全员天王骰";
  else if (heavies === 1) shape = "带了一位天王";
  else shape = "天王占多数";

  const dead = composition.face.blank + composition.fate.asleep;
  const ratio = composition.face.total === 0 ? 0 : dead / composition.face.total;
  const riskHint = ratio >= 0.34
    ? "空面、沉眠偏多，易手忙脚乱"
    : ratio <= 0.15
      ? "有效面充足"
      : "";
  const suitHint = composition.dominantSuit && composition.dominantSuit.primaryDice >= 3
    ? `${composition.dominantSuit.label}${composition.dominantSuit.primaryDice}骰同色，同花可期`
    : "";

  /* 摘要只留“阵容形状 + 一条最有用的提示”，确保右栏稳定在一行左右。
     同花成形时优先报同花；否则才报空眠风险。 */
  const detail = suitHint || riskHint;
  return `${shape}${detail ? `；${detail}` : ""}。`;
}

/* ============ 出击令 ============
 * 出发时写入 sessionStorage，供 battle 页在自己的入口里读取。
 * 这不是 app 间 import：map 只写一个约定键名，battle 是否读、怎么读
 * 由它自己决定（与 shared/transition 的 handoff 同一思路）。 */

export const SORTIE_ORDER_STORAGE_KEY = "abyssa:sortie-order:v1";

export interface SortieOrder {
  version: 1;
  nodeId: MapLocationId;
  memberIds: string[];
  command: SortieCommandMode;
  diceCount: number;
  issuedAt: number;
}

export function buildSortieOrder(nodeId: MapLocationId, party: SortieParty, issuedAt: number): SortieOrder {
  return {
    version: 1,
    nodeId,
    memberIds: [...party.memberIds],
    command: party.command,
    diceCount: countDice(party),
    issuedAt
  };
}

/** 出击令为何不能出门。返回 null 即放行。
 *  写入前必须过这一关：sessionStorage 是跨文档边界，battle 端拿到的东西
 *  这里若不查，就再没有地方查了。 */
export function explainSortieOrderRejection(
  roster: readonly SortieMember[],
  nodeIds: readonly MapLocationId[],
  nodeId: MapLocationId,
  party: SortieParty
): string | null {
  if (!nodeIds.includes(nodeId)) return "未知的出击节点。";
  if (!canDepart(party)) return "至少要带一个人。";
  if (party.memberIds.length > SORTIE_SLOT_COUNT) return `一趟最多带 ${SORTIE_SLOT_COUNT} 人。`;
  if (new Set(party.memberIds).size !== party.memberIds.length) return "名单里有重复的人。";
  for (const id of party.memberIds) {
    const member = findSortieMember(roster, id);
    if (!member) return "名单里有查无此人的条目。";
    if (!isMemberAvailable(member)) return `${member.shortName}现在出不了门。`;
  }
  return null;
}

export function saveSortieOrder(storage: Pick<Storage, "setItem">, order: SortieOrder): void {
  storage.setItem(SORTIE_ORDER_STORAGE_KEY, JSON.stringify(order));
}
