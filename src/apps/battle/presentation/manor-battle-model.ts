import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { DemoEvent } from "../../../game-core/battle";
import type { ExpeditionDieFace } from "../ExpeditionDie3D";
import type {
  BattleSurfaceEnemy,
  BattleSurfaceMember,
} from "./battle-surface-model";
import { manorEnemyArt } from "../../../content/presentation/old-manor";

export function manorFace(
  face: DemoJourneyView["party"][number]["faces"][number],
): ExpeditionDieFace {
  const kind = face.kind;
  const verb =
    kind === "protect" || kind === "guard-all"
      ? "guard"
      : kind === "expensive-heal"
        ? "heal"
        : kind === "cleave-left" ||
            kind === "cleave-right" ||
            kind === "thread-strike"
          ? "attack"
          : kind === "bind"
            ? "art"
            : kind;
  return {
    verb,
    power: face.power,
    quality: face.quality,
    name: face.name,
    pip: face.pip.kind === "natural" ? face.pip.value : undefined,
    wildPip: face.pip.kind === "wild",
    suit: face.suit === "light" ? "holy" : face.suit,
    asleep: face.fate === "asleep",
  };
}
/* ---------- 点击目标推导 ----------
 * 与裂隙版 battle-view-model 的 getMemberTargetCommand / getEnemyTargetCommand
 * 同语义：拿骰 → 点队友 / 点敌人 / 点意图，三条路径在两套内容里必须一致。
 * 这里只从 game-core 已给出的合法 options 里挑选，不自创合法性。 */

type ManorActionOption = { choice: string; targetId: string | null };
type ManorThreatSource = {
  id: string;
  /** 意图剩余实伤（value − blocked，含束缚归零），用来选「威胁最大」。 */
  damage: number;
  intent?: { kind: string; targetId?: string | null } | null;
};
export type ManorTargetAction = {
  choice: "attack" | "guard" | "heal" | "bind" | "guard-all";
  targetId: string | null;
};

/** 点队友卡：治疗优先；其次为被攻击的队友格挡剩余威胁最大的敌人。 */
export function manorMemberTargetAction(
  options: readonly ManorActionOption[],
  enemies: readonly ManorThreatSource[],
  targetId: string,
): ManorTargetAction | null {
  if (options.some((o) => o.choice === "heal" && o.targetId === targetId))
    return { choice: "heal", targetId };
  const attackers = enemies.filter(
    (e) => e.intent?.kind === "attack" && e.intent.targetId === targetId,
  );
  if (!attackers.length) return null;
  if (options.some((o) => o.choice === "guard-all"))
    return { choice: "guard-all", targetId: null };
  const threat = attackers
    .filter((e) =>
      options.some((o) => o.choice === "guard" && o.targetId === e.id),
    )
    .sort((a, b) => b.damage - a.damage)[0];
  return threat ? { choice: "guard", targetId: threat.id } : null;
}

/** 点敌人卡体：攻击／提线优先；其次格挡该敌人的攻击意图。 */
export function manorEnemyTargetAction(
  options: readonly ManorActionOption[],
  enemies: readonly ManorThreatSource[],
  enemyId: string,
): ManorTargetAction | null {
  const direct = options.find(
    (o) => (o.choice === "attack" || o.choice === "bind") && o.targetId === enemyId,
  );
  if (direct)
    return { choice: direct.choice as "attack" | "bind", targetId: enemyId };
  if (!enemies.some((e) => e.id === enemyId && e.intent?.kind === "attack"))
    return null;
  if (options.some((o) => o.choice === "guard" && o.targetId === enemyId))
    return { choice: "guard", targetId: enemyId };
  if (options.some((o) => o.choice === "guard-all"))
    return { choice: "guard-all", targetId: null };
  return null;
}

export function manorBattleModel(
  view: DemoJourneyView,
  heldActor: string | null,
) {
  const battle = view.battle;
  const options =
    view.party.find((p) => p.id === heldActor)?.actions.options ?? [];
  const party: BattleSurfaceMember[] = view.party.map((m) => {
    const targeting =
      battle?.enemies.filter(
        (e) => e.intent?.kind === "attack" && e.intent.targetId === m.id,
      ) ?? [];
    const incoming = {
      raw: targeting.reduce((n, e) => n + (e.intent?.value ?? 0), 0),
      final: targeting.reduce((n, e) => n + e.damage, 0),
    };
    const shield = targeting.reduce(
      (n, e) => n + Math.min(e.intent!.value, e.intent!.blocked),
      0,
    );
    return {
      id: m.id,
      hp: m.hp,
      maxHp: m.config.maxHp,
      returnHp: 1,
      downed: !m.hp,
      ready: !!m.actions.options.length,
      incoming,
      shield,
      shieldLabel: `当前来袭意图已格挡 ${shield} 点伤害`,
      healable: options.some((o) => o.choice === "heal" && o.targetId === m.id),
    };
  });
  const enemies: BattleSurfaceEnemy[] = (battle?.enemies ?? []).map((e) => {
    const i = e.intent,
      def = e.definition;
    const bound = e.boundRound === battle?.encounter.round;
    const target = view.party.find((m) => m.id === i?.targetId);
    const memoryBoss = def.id === "enemy.memory.marietta";
    const clockwork = def.artId === "old-manor.clockwork-beast";
    const title = bound
      ? "束缚"
      : i?.operation === "memory-reorder" ? "收线重排" : memoryBoss && i?.kind === "attack" ? "裁定" : i?.kind === "attack"
        ? def.behavior === "butler"
          ? "落幕"
          : def.behavior === "heiress" ? "举杯" : clockwork ? "钟鸣重击" : "攻击"
        : i?.kind === "summon"
          ? "补席"
        : i?.kind === "seal"
          ? "门扉闭合"
          : i?.kind === "charge"
            ? clockwork ? "摆锤蓄势" : "举盘"
            : i?.kind === "repair"
              ? "缝补"
              : "待命";
    const description = `${memoryBoss ? `侍偶护域：${e.protection ?? 0}。` : ""}${def.name} · ${title}${bound ? "：本回合无法行动" : i?.kind === "attack" ? target?.hp === 0 ? "：锁定目标已力竭，本轮落空" : `：对${target?.name}造成 ${e.damage} 点伤害${i.formula ? `（2＋${view.banquet?.guests ?? 0}位宾客，已格挡${i.blocked}）` : ""}` : i?.kind === "summon" ? `：${view.banquet?.reserve && view.banquet.guests < view.banquet.limit ? "补入一位候席客，下一回合行动" : "已满席或储备耗尽，本轮空过"}；剩余储备${view.banquet?.reserve ?? 0}` : i?.kind === "seal" ? `：下回合封锁${target?.name}的命数骰` : i?.kind === "charge" ? "：蓄力，下回合重击" : i?.kind === "repair" ? "：为锁定的受伤同伴恢复 1 点生命" : i?.operation === "memory-reorder" ? "：调整侍偶邻接位置，既有出手队列不变" : "：暂时待命"}${options.some(o => o.choice === "attack" && o.targetId === e.id) ? `；本次实伤预览 ${options.filter(o => o.choice === "attack" && o.targetId === e.id).map(o => "damage" in o && o.damage && typeof o.damage === "object" && "applied" in o.damage ? o.damage.applied : o.amount).join("／")}` : ""}`;
    const art = manorEnemyArt[def.artId!];
    return {
      id: e.id,
      name: def.name!,
      hp: e.hp,
      maxHp: def.hp,
      attack: def.attack,
      art: def.artId!,
      artUrl: art.url,
      artStyle: { height: art.height, width: "auto", maxWidth: "100%", objectFit: "contain", objectPosition: "center bottom" },
      blocked: i?.blocked ?? 0,
      intent: i
        ? {
            type: bound ? "idle" : i.kind,
            title,
            value: target?.hp === 0 ? 0 : i.value,
            ...(target ? { targetId: target.id } : {}),
            description,
          }
        : null,
      defeated: def.behavior !== "heiress" && !memoryBoss && e.hp <= 0,
      frenzyActive: false,
      frenzyWarning: null,
      threat:
        i?.kind !== "attack"
          ? null
          : !e.damage
            ? "blocked"
            : target && e.damage >= target.hp
              ? "lethal"
              : "normal",
      targetable: options.some(
        (o) =>
          (o.choice === "attack" || o.choice === "bind") && o.targetId === e.id,
      ),
      intentBlockable: options.some(
        (o) =>
          (o.choice === "guard" && o.targetId === e.id) ||
          o.choice === "guard-all",
      ),
    };
  });
  return { party, enemies };
}
/** Receipt deltas affect a disposable visual copy, never authoritative state or legality. */
export function showManorEvent(
  view: DemoJourneyView,
  event: DemoEvent,
  committed?: DemoJourneyView,
): DemoJourneyView {
  const next = structuredClone(view),
    p = event.payload as Record<string, unknown>;
  if (event.type === "damage-applied" || event.type === "healing-applied") {
    const member = next.party.find((m) => m.id === p.targetId),
      enemy = next.battle?.enemies.find((e) => e.id === p.targetId);
    if (member && typeof p.hpAfter === "number") member.hp = p.hpAfter;
    if (enemy && typeof p.hpAfter === "number") enemy.hp = p.hpAfter;
  }
  if (event.type === "enemy-repaired") {
    const target = next.battle?.enemies.find((e) => e.id === p.targetId);
    if (target && typeof p.hpAfter === "number") target.hp = p.hpAfter;
  }
  if (event.type === "guard-applied") {
    const e = next.battle?.enemies.find((e) => e.id === p.enemyId);
    if (e?.intent) {
      e.intent.blocked += Number(p.amount);
      e.damage = Math.max(0, e.intent.value - e.intent.blocked);
    }
  }
  if (event.type === "action-resolved") {
    const die = next.party.find((m) => m.id === event.actorId)?.die;
    if (die) die.spent = true;
  }
  if (event.type === "enemy-defeated" && next.expedition)
    next.expedition.run.looseGold += Number(p.bounty);
  if (event.type === "enemy-summoned" && next.battle) {
    const source = committed?.battle?.enemies.find(e => e.id === p.targetId);
    if (source && !next.battle.enemies.some(e => e.id === source.id)) {
      next.battle.enemies.push({...structuredClone(source), hp: source.definition.hp, intent: null, damage: 0});
      if (next.banquet) next.banquet.reserve = Math.max(0, next.banquet.reserve - 1);
    }
  }
  if (event.type === "banquet-seats-changed" && next.banquet) {
    next.banquet.guests = Number(p.after); next.banquet.nextToast = Number(p.toastPower);
    next.battle?.enemies.forEach(e => {if (e.intent?.formula) {e.intent.value = Math.max(0, next.banquet!.nextToast - e.intent.formula.reduction); e.damage = e.boundRound === next.battle!.encounter.round ? 0 : Math.max(0, e.intent.value - e.intent.blocked);}});
  }
  if (event.type === "formation-reordered" && next.battle) {
    const order = p.after as string[];
    next.battle.encounter.formation = [...order];
    next.battle.enemies.sort((a,b) => order.indexOf(a.id) - order.indexOf(b.id));
  }
  if (event.type === "memory-defender-released" && next.battle) next.battle.enemies = next.battle.enemies.filter(e => e.id !== p.targetId);
  if ((event.type === "damage-applied" || event.type === "formation-reordered") && next.battle && committed?.battle) for (const e of next.battle.enemies) e.protection = committed.battle.enemies.find(x => x.id === e.id)?.protection ?? e.protection;
  if (event.type === "enemy-released" && next.battle) {
    next.battle.enemies = next.battle.enemies.filter(e => e.id !== p.targetId);
    if (next.expedition) next.expedition.run.looseGold += Number(p.bounty);
  }
  return next;
}
