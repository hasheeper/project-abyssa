import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { randomRollDuration } from "../../shared/presentation/roll/timing";
import { ActionDock, ActionDockSlot } from "../../shared/ui/patterns/action-dock/ActionDock";
import { DiceActionButton } from "../../shared/ui/patterns/action-dock/DiceActionButton";
import { ExpeditionBagOdometer, ExpeditionOdometer } from "./ExpeditionReels";
import {
  ExpeditionDie3D,
  getExpeditionDieRotation,
  nextExpeditionDieRotation,
  type ExpeditionDieFace,
  type ExpeditionDieRotation,
  type ExpeditionDieSuit
} from "./ExpeditionDie3D";
import {
  CHARACTERS,
  DOWNED_RETURN_HP,
  FRENZY_ATTACK_BONUS,
  LAYER_MULTIPLIERS,
  MAX_HP,
  MAX_LAYER,
  PARTY_ORDER,
  canActWith,
  canToggleLoad,
  canUndo,
  evaluateHand,
  getBattlePhase,
  getEffectiveFaceQuality,
  getExpeditionStatus,
  getGildFaceCount,
  getFrenzyWarningRounds,
  getGreedSummary,
  getIncomingDamageFor,
  getIntentThreat,
  isEnemyFrenzied,
  getLayerPayout,
  getRustFaceCount,
  getRoundOutcome,
  getStateFace,
  getUndoLabel,
  hasUnloadedDice,
  isEnemyDefeated,
  type BattleCommand,
  type BattleTransition,
  type CharacterId,
  type EnemyIntent,
  type EnemyState,
  type EnemyTurnEvent,
  type ExpeditionState,
  type HandEvaluation,
  type LayerSettlement,
  type Rng
} from "./engine";
import {
  getEnemyTurnCue,
  getPlayerAttackCue,
  getPlayerSupportCue,
  type PlayerSupportCue
} from "./controller/presentation-events";
import { useExpeditionBattleController } from "./controller/useExpeditionBattleController";
import { usePresentationQueue } from "./controller/usePresentationQueue";
import { ExpeditionGlyph, type GlyphName } from "./ExpeditionGlyph";
import { FrameEdgeWeave } from "../../shared/ui/patterns/internal/FrameEdgeWeave";
import {
  BATTLE_UI_SKINS,
  getNextBattleUiSkin,
  resolveBattleUiSkin,
  type BattleUiSkin
} from "./battleUiSkins";
import kaelPortrait from "../../assets/png/kael.png";
import eusticePortrait from "../../assets/png/eustice.png";
import eloraPortrait from "../../assets/png/elora.png";
import kororoPortrait from "../../assets/png/kororo.png";
import normaPortrait from "../../assets/png/norma.png";
import blightedSentinel from "../../assets/png3/monster/blighted_sentinel.png";
import crystallineChoir from "../../assets/png3/monster/crystalline_choir.png";
import miasmaAmalgam from "../../assets/png3/monster/miasma_amalgam.png";

/* ============================================================
   展示配置
============================================================ */

type PartyVisual = {
  id: CharacterId;
  name: string;
  nameplate: string;
  portrait: string;
  tone: "steel" | "crimson" | "verdant" | "violet" | "ochre";
  skills: readonly string[];
  themeColor: string;
  suit: ExpeditionDieSuit;
};

const PARTY_VISUALS: Record<CharacterId, PartyVisual> = {
  kael: {
    id: "kael",
    name: "凯尔",
    nameplate: "KAEL",
    portrait: kaelPortrait,
    tone: "steel",
    skills: ["all-for-one", "sword", "split-cross"],
    themeColor: "#3d6079",
    suit: "holy"
  },
  eustice: {
    id: "eustice",
    name: "尤斯缇丝",
    nameplate: "EUSTICE",
    portrait: eusticePortrait,
    tone: "crimson",
    skills: ["sword", "split-cross", "fast-arrow"],
    themeColor: "#7b342f",
    suit: "holy"
  },
  elora: {
    id: "elora",
    name: "艾洛拉",
    nameplate: "ELORA",
    portrait: eloraPortrait,
    tone: "verdant",
    skills: ["miracle", "wand", "heart"],
    themeColor: "#477051",
    suit: "earth"
  },
  kororo: {
    id: "kororo",
    name: "柯萝萝",
    nameplate: "KORORO",
    portrait: kororoPortrait,
    tone: "violet",
    skills: ["gravity", "star", "moon"],
    themeColor: "#654b72",
    suit: "abyss"
  },
  norma: {
    id: "norma",
    name: "诺玛",
    nameplate: "NORMA",
    portrait: normaPortrait,
    tone: "ochre",
    skills: ["arsenal", "mask", "fast-arrow"],
    themeColor: "#7d643d",
    suit: "earth"
  }
};

const ENEMY_ART: Record<EnemyState["art"], string> = {
  sentinel: blightedSentinel,
  amalgam: miasmaAmalgam,
  choir: crystallineChoir
};

/* 一排恒为六格：最大值只占一半时，剩余格位保留为暗槽 */
const PIP_SLOTS = 6;

const INTENT_GLYPH: Record<string, GlyphName> = {
  attack: "intent-attack",
  charge: "intent-charge",
  seal: "intent-seal",
  countdown: "intent-countdown",
  summon: "intent-summon"
};

const LOG_TONE_COLOR: Record<string, string> = {
  good: "verdant",
  bad: "enemy",
  gold: "value",
  purple: "loot",
  system: "system"
};

/** 引擎骰面 → 3D 骰面视图（包含本次远征积累的锈蚀）。 */
function buildDieFaces(ownerId: CharacterId, rustLevel: number): ExpeditionDieFace[] {
  return CHARACTERS[ownerId].faces.map((face, faceIndex) => ({
    verb: face.verb,
    power: face.power,
    quality: getEffectiveFaceQuality(ownerId, faceIndex, rustLevel),
    wildPip: face.wildPip
  }));
}

/* ============================================================
   意图线坐标：936 宽坐标系中，敌人取列中心，队伍五列固定锚点
============================================================ */

const INTENT_VIEW_WIDTH = 936;
const PARTY_ANCHOR_X = [136, 302, 468, 634, 800] as const;

function enemyAnchorX(index: number, count: number): number {
  return ((index + 0.5) / Math.max(count, 1)) * INTENT_VIEW_WIDTH;
}

function partyAnchorX(memberId: CharacterId): number {
  const index = PARTY_ORDER.indexOf(memberId);
  return PARTY_ANCHOR_X[index] ?? INTENT_VIEW_WIDTH / 2;
}

/* ============================================================
   动态队伍连接线（选中骰子时点亮）
============================================================ */

/* 36 段在当前显示尺寸下已足够平滑；原 72 段会把五条光束的字符串重建成本翻倍。 */
const PARTY_LINK_SEGMENTS = 36;
const PARTY_LINK_FRAME_INTERVAL = 1000 / 30;

type PartyLinkSample = {
  pX: number;
  pY: number;
  nX: number;
  nY: number;
  damping: number;
  t: number;
};

function getPartyLinkSamples(): PartyLinkSample[] {
  /* The lock seal is the physical source of the filament. Build the path
     upward from that exact anchor so its animated strands cannot drift past
     the diamond and appear to originate inside the die. */
  const start = { x: 32, y: 90 };
  const end = { x: 32, y: 0 };
  const c1 = { x: 32, y: 60 };
  const c2 = { x: 32, y: 30 };

  return Array.from({ length: PARTY_LINK_SEGMENTS }, (_, index) => {
    const t = (index + 1) / PARTY_LINK_SEGMENTS;
    const mt = 1 - t;
    const pX = mt ** 3 * start.x + 3 * mt ** 2 * t * c1.x + 3 * mt * t ** 2 * c2.x + t ** 3 * end.x;
    const pY = mt ** 3 * start.y + 3 * mt ** 2 * t * c1.y + 3 * mt * t ** 2 * c2.y + t ** 3 * end.y;
    const dX = 3 * mt ** 2 * (c1.x - start.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t ** 2 * (end.x - c2.x);
    const dY = 3 * mt ** 2 * (c1.y - start.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t ** 2 * (end.y - c2.y);
    const length = Math.hypot(dX, dY) || 1;

    return { t, pX, pY, nX: -dY / length, nY: dX / length, damping: Math.sin(t * Math.PI) };
  });
}

function getAnimatedPartyLinkPath(
  samples: PartyLinkSample[],
  time: number,
  frequency: number,
  amplitude: number,
  speed: number,
  phase: number
) {
  let path = "M 32 90 ";
  samples.forEach((sample) => {
    const wave = Math.sin(sample.t * Math.PI * frequency + time * speed + phase);
    const offset = amplitude * sample.damping * wave;
    path += `L ${sample.pX + sample.nX * offset} ${sample.pY + sample.nY * offset} `;
  });
  return path;
}

function AnimatedPartyLink({ active }: { active: boolean }) {
  const auraRef = useRef<SVGPathElement>(null);
  const mainRef = useRef<SVGPathElement>(null);
  const highRef = useRef<SVGPathElement>(null);
  const samples = useMemo(() => getPartyLinkSamples(), []);
  const staticPath = "M32 90 C32 60, 32 30, 32 0";

  useEffect(() => {
    const resetToStatic = () => {
      auraRef.current?.setAttribute("d", staticPath);
      mainRef.current?.setAttribute("d", staticPath);
      highRef.current?.setAttribute("d", staticPath);
    };

    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || reducedMotion) {
      resetToStatic();
      return;
    }

    let frame = 0;
    let lastDraw = -PARTY_LINK_FRAME_INTERVAL;
    const draw = (time: number) => {
      if (time - lastDraw >= PARTY_LINK_FRAME_INTERVAL) {
        lastDraw = time;
        auraRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 1.5, 5, .0008, 0));
        mainRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 2.2, 3, .0016, Math.PI / 4));
        highRef.current?.setAttribute("d", getAnimatedPartyLinkPath(samples, time, 3.5, -2, .0022, Math.PI));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, samples]);

  return (
    <span className="abyssa-expedition-party-link" aria-hidden="true">
      <svg viewBox="0 0 64 90" preserveAspectRatio="none">
        <path className="abyssa-expedition-party-link__under" d={staticPath} />
        <path className="abyssa-expedition-party-link__aura" d={staticPath} ref={auraRef} />
        <path className="abyssa-expedition-party-link__main" d={staticPath} ref={mainRef} />
        <path className="abyssa-expedition-party-link__high" d={staticPath} ref={highRef} />
      </svg>
    </span>
  );
}

function FrameRails() {
  return (
    <span className="abyssa-expedition-frame__rails" aria-hidden="true">
      <i data-edge="top" />
      <i data-edge="right" />
      <i data-edge="bottom" />
      <i data-edge="left" />
    </span>
  );
}

function BattleFrameCorners({ imageUrl, skin }: { imageUrl: string; skin: BattleUiSkin }) {
  return (
    <span className="abyssa-expedition-frame__corner-ornaments" aria-hidden="true">
      {(["tl", "tr", "br", "bl"] as const).map((corner) => (
        <img
          key={`${skin}-${corner}`}
          src={imageUrl}
          alt=""
          data-corner={corner}
          draggable={false}
        />
      ))}
    </span>
  );
}

/* ============================================================
   骰子动画外观状态
============================================================ */

type DieVisual = {
  rotation: ExpeditionDieRotation;
  rolling: boolean;
  rollDuration: number;
};

type PlayerAttackPhase =
  | "anticipate"
  | "hitstop"
  | "impact"
  | "recover"
  | "defeat";

type PlayerAttackFx = {
  runId: number;
  actorId: CharacterId;
  targetId: string;
  damage: number;
  lethal: boolean;
  phase: PlayerAttackPhase;
};

type PlayerSupportKind = "guard" | "heal";
type PlayerSupportPhase = "anticipate" | "release" | "impact" | "settle";

type PlayerSupportFx = {
  runId: number;
  kind: PlayerSupportKind;
  actorId: CharacterId;
  targetId: CharacterId;
  amount: number;
  phase: PlayerSupportPhase;
};

type SupportAction = PlayerSupportCue;

type EnemyTurnPhase = "anticipate" | "lunge" | "hitstop" | "impact" | "recover";

type EnemyTurnFx = EnemyTurnEvent & {
  runId: number;
  actionId: number;
  enemyName: string;
  intent: EnemyIntent;
  phase: EnemyTurnPhase;
};

const ATTACK_TIMING = {
  anticipate: 100,
  hitstop: 70,
  impact: 260,
  recover: 320,
  defeat: 460
} as const;

const SUPPORT_TIMING = {
  anticipate: 90,
  release: 120,
  impact: 240,
  settle: 300
} as const;

/*
 * 敌方行动必须严格串行。每个数字对应一只怪物自己的完整演出，
 * 下一只只会在 recover 结束后进入 anticipate。
 */
const ENEMY_TURN_TIMING = {
  anticipate: 120,
  lunge: 100,
  hitstop: 60,
  impact: 320,
  recover: 220
} as const;

/* 最后一只怪物倒下后，留足时间播放斩杀退场，再自动打开层结算。 */
const LAYER_CLEAR_DELAY = 1200;

function getMemberTargetCommand(
  state: ExpeditionState,
  actorId: CharacterId,
  targetId: CharacterId
): BattleCommand | null {
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  const face = die ? getStateFace(state, die) : null;
  if (face?.verb === "heal") {
    return { type: "heal-member", actorId, targetId };
  }
  if (face?.verb !== "guard" && face?.verb !== "wild") return null;
  const threat = state.enemies
    .filter(
      (enemy) =>
        !isEnemyDefeated(enemy) &&
        enemy.intent?.type === "attack" &&
        enemy.intent.targetId === targetId
    )
    .sort((left, right) => {
      const leftRemain =
        (left.intent as Extract<EnemyIntent, { type: "attack" }>).value - left.blocked;
      const rightRemain =
        (right.intent as Extract<EnemyIntent, { type: "attack" }>).value - right.blocked;
      return rightRemain - leftRemain;
    })[0];
  return threat ? { type: "block-intent", actorId, enemyId: threat.id } : null;
}

function getEnemyTargetCommand(
  state: ExpeditionState,
  actorId: CharacterId,
  enemyId: string
): BattleCommand | null {
  const die = state.dice.find((candidate) => candidate.ownerId === actorId);
  const face = die ? getStateFace(state, die) : null;
  if (face?.verb === "attack" || face?.verb === "wild") {
    return { type: "attack-enemy", actorId, enemyId };
  }
  if (face?.verb === "coin") return { type: "steal-from", actorId, enemyId };
  if (face?.verb === "guard") return { type: "block-intent", actorId, enemyId };
  return null;
}

function effectFrameDuration(duration: number): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return duration;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Math.min(duration, 60)
    : duration;
}

function createInitialVisuals(): Record<CharacterId, DieVisual> {
  return Object.fromEntries(
    PARTY_ORDER.map((id) => [
      id,
      { rotation: getExpeditionDieRotation(1), rolling: false, rollDuration: 0.9 }
    ])
  ) as Record<CharacterId, DieVisual>;
}

/* ============================================================
   牌型读数：牌型变化时整块换挡（不是简单淡入）
============================================================ */

function ExpeditionHandReadout({ hand }: { hand: HandEvaluation | null }) {
  const name = hand?.name ?? null;
  const bonus = hand?.adjustedBonus ?? 0;
  const scoring = Boolean(name) && name !== "散牌" && bonus > 0;

  /* 牌型名变化时打一次换挡动画 */
  const [pulseKey, setPulseKey] = useState(0);
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousRef.current === name) return;
    previousRef.current = name;
    setPulseKey((current) => current + 1);
  }, [name]);

  return (
    <output
      className="abyssa-expedition-hand"
      data-scoring={scoring || undefined}
      data-idle={!scoring || undefined}
      aria-label={
        scoring ? `当前牌型 ${name}，倍率 +${bonus}` : "当前无成牌"
      }
    >
      <span className="abyssa-expedition-hand__body" key={pulseKey}>
        <strong className="abyssa-expedition-hand__name">{name ?? "—"}</strong>
        <i className="abyssa-expedition-hand__rule" aria-hidden="true" />
        <span className="abyssa-expedition-hand__bonus">
          <i aria-hidden="true">×</i>
          <b>{scoring ? bonus.toFixed(1) : "—"}</b>
        </span>
      </span>
      <span className="abyssa-expedition-hand__glow" aria-hidden="true" />
    </output>
  );
}

/** 层清后保留完整乘式，避免最后回合倍率在清零时从玩家视野中消失。 */
function LayerSettlementBreakdown({ settlement }: { settlement: LayerSettlement }) {
  const closingBonus = settlement.closingHandBonus;

  return (
    <section
      className="abyssa-expedition-modal__settlement"
      role="region"
      aria-label={
        `第 ${settlement.layer} 层结算：本层散金 ${settlement.baseGold} 金币，` +
        `乘牌型倍率 ${settlement.handFactor.toFixed(2)}，乘层倍率 ${settlement.layerFactor}，` +
        `本层入袋 ${settlement.payout} 金币`
      }
    >
      <div className="abyssa-expedition-modal__settlement-formula">
        <span data-currency="gold">
          <small>本层散金</small>
          <strong>{settlement.baseGold.toLocaleString()}G</strong>
        </span>
        <i aria-hidden="true">×</i>
        <span>
          <small>最终牌型</small>
          <strong>{settlement.handFactor.toFixed(2)}</strong>
        </span>
        <i aria-hidden="true">×</i>
        <span>
          <small>层倍率</small>
          <strong>{settlement.layerFactor}</strong>
        </span>
        <i aria-hidden="true">＝</i>
        <span data-currency="gold" data-result>
          <small>本层入袋</small>
          <strong>＋{settlement.payout.toLocaleString()}G</strong>
        </span>
      </div>
      <p data-counted={closingBonus > 0 || undefined}>
        {closingBonus > 0
          ? `最后回合【${settlement.closingHandName}】倍率 +${closingBonus.toFixed(2)}，已计入最终牌型倍率`
          : "最后回合没有新增牌型倍率"}
      </p>
      <footer>
        <span>包裹 {settlement.bagBefore.toLocaleString()}G</span>
        <i aria-hidden="true">→</i>
        <strong>{settlement.bagAfter.toLocaleString()}G</strong>
      </footer>
    </section>
  );
}

/* ============================================================
   主界面
============================================================ */

export type ExpeditionBattleScreenProps = {
  rng?: Rng;
  uiSkin?: BattleUiSkin;
  defaultUiSkin?: BattleUiSkin;
  onUiSkinChange?: (skin: BattleUiSkin) => void;
};

export function ExpeditionBattleScreen({
  rng,
  uiSkin,
  defaultUiSkin = "timber",
  onUiSkinChange
}: ExpeditionBattleScreenProps = {}) {
  const controller = useExpeditionBattleController(rng);
  const presentation = usePresentationQueue();
  const engine = controller.state;
  const heldActor = controller.heldActor;
  const commitTransition = controller.commitTransition;
  const setHeldActor = controller.holdActor;
  const getEngine = controller.getState;
  const transition = controller.transition;
  const restartBattle = controller.restart;
  const pendingLayerClearId = controller.pendingLayerClearId;
  const acknowledgeLayerClear = controller.acknowledgeLayerClear;
  const [visuals, setVisuals] = useState<Record<CharacterId, DieVisual>>(createInitialVisuals);
  const [attackFx, setAttackFx] = useState<PlayerAttackFx | null>(null);
  const [supportFx, setSupportFx] = useState<PlayerSupportFx | null>(null);
  const [enemyTurnFx, setEnemyTurnFx] = useState<EnemyTurnFx | null>(null);
  const [internalUiSkin, setInternalUiSkin] = useState<BattleUiSkin>(defaultUiSkin);
  const rollTimerRef = useRef<number | null>(null);
  const layerClearTimerRef = useRef<number | null>(null);
  const enemyNodesRef = useRef(new Map<string, HTMLElement>());
  const previousEnemyRectsRef = useRef(new Map<string, DOMRect>());

  const activeUiSkin = uiSkin ?? internalUiSkin;
  const activeUiSkinDefinition = resolveBattleUiSkin(activeUiSkin);
  const activeUiSkinIndex = BATTLE_UI_SKINS.findIndex((skin) => skin.id === activeUiSkin);
  const nextUiSkin = getNextBattleUiSkin(activeUiSkin);
  const nextUiSkinDefinition = resolveBattleUiSkin(nextUiSkin);

  const cycleUiSkin = () => {
    if (uiSkin === undefined) setInternalUiSkin(nextUiSkin);
    onUiSkinChange?.(nextUiSkin);
  };

  const isRolling = PARTY_ORDER.some((id) => visuals[id].rolling);
  const phase = getBattlePhase(engine);
  const status = getExpeditionStatus(engine);
  const layerClearPending = pendingLayerClearId !== null;
  const interactive =
    phase === "act" &&
    status === "active" &&
    !layerClearPending &&
    !isRolling &&
    !presentation.busy &&
    attackFx === null &&
    supportFx === null &&
    enemyTurnFx === null;

  useEffect(() => () => {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    if (layerClearTimerRef.current !== null) window.clearTimeout(layerClearTimerRef.current);
  }, []);

  /*
   * 最后一击已经把敌人即时标记为死亡；不再要求玩家补点 END TURN。
   * 回调再次检查当前状态，避免 StrictMode 或未来的状态回退误触发结算。
   */
  useEffect(() => {
    if (!pendingLayerClearId) return;

    const timer = window.setTimeout(() => {
      if (layerClearTimerRef.current !== timer) return;
      layerClearTimerRef.current = null;
      setHeldActor(null);
      acknowledgeLayerClear();
    }, LAYER_CLEAR_DELAY);
    layerClearTimerRef.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (layerClearTimerRef.current === timer) layerClearTimerRef.current = null;
    };
  }, [acknowledgeLayerClear, pendingLayerClearId, setHeldActor]);

  /* ---------- 掷骰动画 ---------- */

  const animateDice = (after: ExpeditionState) => {
    /*
     * 先在同步作用域内算出完整的滚动计划，再交给 setVisuals。
     * 时长绝不能在 updater 回调里累加——那个回调不同步执行（StrictMode
     * 下还会双调用），会导致收尾定时器永不设置、骰子永久 rolling、
     * 整个盘面锁死。
     */
    const plan: { ownerId: CharacterId; value: number; duration: number }[] = [];

    /*
     * 判据是引擎给出的"本次实际参与掷骰的骰主"，不是"点数有没有变"。
     * 骰子有 1/6 概率掷出相同点数，若按点数变化判断，那枚骰子会干脆
     * 不动——看起来像是它没参与掷骰。
     * nextExpeditionDieRotation 总会多转 2~3 整圈，所以点数相同也转得动。
     */
    const tossed = new Set(after.lastTossed);

    for (const die of after.dice) {
      if (die.sealed || die.faceIndex === null) continue;
      if (!tossed.has(die.ownerId)) continue;

      plan.push({
        ownerId: die.ownerId,
        value: die.faceIndex + 1,
        duration: randomRollDuration()
      });
    }

    if (plan.length === 0) return;

    const maxDuration = plan.reduce(
      (longest, entry) => Math.max(longest, entry.duration),
      0
    );

    setVisuals((current) => {
      const next = { ...current };
      for (const entry of plan) {
        next[entry.ownerId] = {
          rotation: nextExpeditionDieRotation(current[entry.ownerId].rotation, entry.value),
          rolling: true,
          rollDuration: entry.duration
        };
      }
      return next;
    });

    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    rollTimerRef.current = window.setTimeout(() => {
      setVisuals((current) => {
        const next = { ...current };
        for (const id of PARTY_ORDER) next[id] = { ...next[id], rolling: false };
        return next;
      });
      rollTimerRef.current = null;
    }, maxDuration * 1000 + 80);
  };

  /* 回合开始自动掷骰：掷骰不是决策，无需玩家点按，也不可撤销 */
  useEffect(() => {
    if (phase !== "roll" || status !== "active") return;
    const result = transition({ type: "roll-dice" }, engine);
    if (result.error) return;
    animateDice(result.state);
    commitTransition(result);
    setHeldActor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, status, engine.round, engine.layer]);

  /* ---------- 玩家攻击演出 ---------- */

  const setAttackPhase = (runId: number, nextPhase: PlayerAttackPhase) => {
    setAttackFx((current) =>
      current?.runId === runId ? { ...current, phase: nextPhase } : current
    );
  };

  const playPlayerAttack = async (
    result: BattleTransition,
    actorId: CharacterId,
    targetId: string,
    damage: number,
    lethal: boolean
  ) => {
    const runId = presentation.begin();
    if (runId === null) return;
    setAttackFx({
      runId,
      actorId,
      targetId,
      damage,
      lethal,
      phase: "anticipate"
    });

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.anticipate), runId))) return;
    setAttackPhase(runId, "hitstop");

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.hitstop), runId))) return;
    /* 规则依然即时计算，但把可见状态提交对齐到斩击命中帧。 */
    commitTransition(result);
    setHeldActor(null);
    setAttackPhase(runId, "impact");

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.impact), runId))) return;
    setAttackPhase(runId, lethal ? "defeat" : "recover");

    if (
      !(await presentation.wait(
        effectFrameDuration(lethal ? ATTACK_TIMING.defeat : ATTACK_TIMING.recover),
        runId
      ))
    ) {
      return;
    }

    setAttackFx((current) => (current?.runId === runId ? null : current));
    presentation.complete(runId);
  };

  /* ---------- 玩家防御 / 治疗演出 ---------- */

  const setSupportPhase = (runId: number, nextPhase: PlayerSupportPhase) => {
    setSupportFx((current) =>
      current?.runId === runId ? { ...current, phase: nextPhase } : current
    );
  };

  const playPlayerSupport = async (result: BattleTransition, action: SupportAction) => {
    const runId = presentation.begin();
    if (runId === null) return;
    setSupportFx({ ...action, runId, phase: "anticipate" });

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.anticipate), runId))) return;
    setSupportPhase(runId, "release");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.release), runId))) return;
    /* 盾层、生命与昂贵治疗的金币变化统一在支援命中帧提交。 */
    commitTransition(result);
    setHeldActor(null);
    setSupportPhase(runId, "impact");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.impact), runId))) return;
    setSupportPhase(runId, "settle");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.settle), runId))) return;
    setSupportFx((current) => (current?.runId === runId ? null : current));
    presentation.complete(runId);
  };

  /* ---------- 敌方回合：按公开意图逐只结算 ---------- */

  const setEnemyTurnPhase = (
    runId: number,
    actionId: number,
    nextPhase: EnemyTurnPhase
  ) => {
    setEnemyTurnFx((current) =>
      current?.runId === runId && current.actionId === actionId
        ? { ...current, phase: nextPhase }
        : current
    );
  };

  const playEnemyTurn = async () => {
    const runId = presentation.begin();
    if (runId === null) return;

    const prepared = transition({ type: "begin-enemy-turn" }, getEngine());
    if (prepared.error) {
      presentation.complete(runId);
      return;
    }
    let presentationIndex = 0;
    commitTransition(prepared);
    setHeldActor(null);

    while (true) {
      if (!presentation.isCurrent(runId)) return;
      const current = getEngine();
      if (
        current.mode.type !== "enemy-turn" ||
        current.mode.cursor >= current.mode.enemyOrder.length
      ) {
        break;
      }

      const enemyId = current.mode.enemyOrder[current.mode.cursor]!;
      const actingEnemy = current.enemies.find((enemy) => enemy.id === enemyId);
      const intent = actingEnemy?.intent;
      if (!actingEnemy || !intent) break;

      const step = transition({ type: "resolve-next-enemy" }, current);
      const cue = getEnemyTurnCue(step.events);
      if (step.error || !cue) break;

      const actionId = runId * 100 + presentationIndex;
      presentationIndex += 1;
      setEnemyTurnFx({
        ...cue,
        runId,
        actionId,
        enemyName: actingEnemy.name,
        intent,
        phase: "anticipate"
      });

      if (!(await presentation.wait(effectFrameDuration(ENEMY_TURN_TIMING.anticipate), runId))) return;
      setEnemyTurnPhase(runId, actionId, "lunge");

      if (!(await presentation.wait(effectFrameDuration(ENEMY_TURN_TIMING.lunge), runId))) return;
      setEnemyTurnPhase(runId, actionId, "hitstop");

      if (!(await presentation.wait(effectFrameDuration(ENEMY_TURN_TIMING.hitstop), runId))) return;
      commitTransition(step);
      setEnemyTurnPhase(runId, actionId, "impact");

      if (!(await presentation.wait(effectFrameDuration(ENEMY_TURN_TIMING.impact), runId))) return;
      setEnemyTurnPhase(runId, actionId, "recover");

      if (!(await presentation.wait(effectFrameDuration(ENEMY_TURN_TIMING.recover), runId))) return;
    }

    if (!presentation.isCurrent(runId)) return;
    const completed = transition({ type: "finish-enemy-turn" }, getEngine());
    if (completed.error) {
      setEnemyTurnFx(null);
      presentation.complete(runId);
      return;
    }
    let finalTransition = completed;
    if (getRoundOutcome(completed.state) === "continue") {
      const nextRound = transition({ type: "next-round" }, completed.state);
      if (!nextRound.error) finalTransition = nextRound;
    }
    setEnemyTurnFx(null);
    presentation.complete(runId);
    commitTransition(finalTransition);
  };

  /* ---------- 骰子：多选装载 ---------- */

  const handleDieToggle = (index: number) => {
    if (
      !interactive ||
      presentation.isBusy() ||
      !canToggleLoad(engine, index)
    ) {
      return;
    }
    const result = transition({ type: "toggle-load", dieIndex: index }, engine);
    if (result.error) return;
    commitTransition(result);
    /* 卸载了正拿着的角色则松手 */
    const owner = engine.dice[index]?.ownerId;
    if (owner && owner === heldActor && engine.dice[index]!.loaded) {
      setHeldActor(null);
    }
  };

  /* ---------- 重掷：不可撤销，会清空撤销栈 ---------- */

  const handleReroll = () => {
    if (
      !interactive ||
      presentation.isBusy() ||
      engine.rerollsRemaining <= 0
    ) {
      return;
    }
    const result = transition({ type: "reroll-dice" }, engine);
    if (result.error) return;
    animateDice(result.state);
    commitTransition(result);
    setHeldActor(null);
  };

  /* ---------- 撤销 ---------- */

  const handleUndo = () => {
    if (
      !interactive ||
      presentation.isBusy() ||
      !canUndo(engine)
    ) {
      return;
    }
    const result = transition({ type: "undo" }, engine);
    if (result.error) return;
    commitTransition(result);
    setHeldActor(null);
  };

  /* ---------- 跳过此回合 → 敌方行动 ---------- */

  const handleEndTurn = () => {
    if (
      !interactive ||
      presentation.isBusy()
    ) {
      return;
    }
    void playEnemyTurn();
  };

  /* ---------- 角色卡：拿起 / 放下 ---------- */

  const handleMemberCardClick = (memberId: CharacterId) => {
    if (!interactive || presentation.isBusy()) return;

    /* 已拿着别人 → 尝试对该队员施放（治疗 / 格挡） */
    if (heldActor && heldActor !== memberId) {
      const command = getMemberTargetCommand(engine, heldActor, memberId);
      if (command) applyAction(transition(command, engine));
      return;
    }

    /* 点自己：能自用则施放，否则切换拿起状态 */
    if (heldActor === memberId) {
      const command = getMemberTargetCommand(engine, memberId, memberId);
      const result = command ? transition(command, engine) : null;
      if (result && !result.error) {
        applyAction(result);
        return;
      }
      setHeldActor(null);
      return;
    }

    if (!canActWith(engine, memberId)) return;
    setHeldActor(memberId);
  };

  /* ---------- 目标：领域事件直接选择攻击 / 支援演出 ---------- */

  const applyAction = (result: BattleTransition) => {
    if (result.error || presentation.isBusy()) return;

    const supportAction = getPlayerSupportCue(result.events);
    if (supportAction) {
      void playPlayerSupport(result, supportAction);
      return;
    }

    commitTransition(result);
    setHeldActor(null);
  };

  const handleEnemyClick = (enemyId: string) => {
    if (
      !interactive ||
      !heldActor ||
      presentation.isBusy()
    ) {
      return;
    }

    const actorId = heldActor;
    const command = getEnemyTargetCommand(engine, actorId, enemyId);
    if (!command) return;
    const result = transition(command, engine);
    if (result.error) return;

    const attack = getPlayerAttackCue(result.events);
    if (attack) {
      void playPlayerAttack(
        result,
        attack.actorId,
        attack.targetId,
        attack.damage,
        attack.lethal
      );
      return;
    }

    applyAction(result);
  };

  const handleIntentClick = (enemyId: string) => {
    if (
      !interactive ||
      !heldActor ||
      presentation.isBusy()
    ) {
      return;
    }
    applyAction(
      transition(
        { type: "block-intent", actorId: heldActor, enemyId },
        engine
      )
    );
  };

  const handleRestart = () => {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    rollTimerRef.current = null;
    if (layerClearTimerRef.current !== null) window.clearTimeout(layerClearTimerRef.current);
    layerClearTimerRef.current = null;
    presentation.cancel();
    setAttackFx(null);
    setSupportFx(null);
    setEnemyTurnFx(null);
    restartBattle();
    setVisuals(createInitialVisuals());
  };

  const handleGoDeeper = () => {
    const result = transition({ type: "go-deeper" }, engine);
    commitTransition(result);
  };

  const handleLeaveExpedition = () => {
    const result = transition({ type: "leave-expedition" }, engine);
    commitTransition(result);
  };

  /* ---------- 派生数据 ---------- */

  const hand = useMemo(
    () => (phase === "act" ? evaluateHand(engine) : null),
    [engine, phase]
  );

  /* 参与当前牌型的骰主：点亮其命数角标 */
  const scoringOwners = useMemo(
    () => new Set(hand?.contributors ?? []),
    [hand]
  );

  /* 斩杀命中后保留目标节点，直到退场动画播放完成。 */
  const presentedEnemies = engine.enemies.filter(
    (enemy) =>
      !isEnemyDefeated(enemy) ||
      enemy.id === attackFx?.targetId ||
      enemy.id === enemyTurnFx?.enemyId
  );
  const enemyLayoutKey = presentedEnemies.map((enemy) => enemy.id).join("|");

  /* 怪物退场后，幸存者从旧槽位平滑补到新槽位，避免网格瞬移。 */
  useLayoutEffect(() => {
    const previous = previousEnemyRectsRef.current;
    const current = new Map<string, DOMRect>();

    for (const enemy of presentedEnemies) {
      const node = enemyNodesRef.current.get(enemy.id);
      if (!node) continue;

      const nextRect = node.getBoundingClientRect();
      current.set(enemy.id, nextRect);
      const previousRect = previous.get(enemy.id);
      if (!previousRect || typeof node.animate !== "function") continue;

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) continue;

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" }
        ],
        {
          duration: effectFrameDuration(320),
          easing: "cubic-bezier(.2, .78, .22, 1)"
        }
      );
    }

    previousEnemyRectsRef.current = current;
  }, [enemyLayoutKey]);

  /*
   * 普通行动阶段只展示已入账倍率；最后一只怪物倒下后，自动结算前的
   * 1.2 秒直接预览含本回合牌型的最终值，避免结果看起来凭空跳变。
   */
  const closingHandBonus = layerClearPending ? (hand?.adjustedBonus ?? 0) : 0;
  const displayedHandBonus = engine.handMultiplier + closingHandBonus;
  const handFactor = Math.round((1 + displayedHandBonus) * 100) / 100;
  const layerFactor = LAYER_MULTIPLIERS[engine.layer - 1] ?? LAYER_MULTIPLIERS[4];
  /* 本层预计入袋 = 散金 × 牌型 × 层倍率 */
  const projected = layerClearPending
    ? getLayerPayout({ ...engine, handMultiplier: displayedHandBonus })
    : getLayerPayout(engine);

  /* 拿起的角色骰面，决定哪些目标高亮 */
  const heldFace = heldActor
    ? getStateFace(engine, engine.dice.find((die) => die.ownerId === heldActor)!)
    : null;
  const heldVerb = heldFace?.verb ?? null;

  const undoLabel = getUndoLabel(engine);
  const undoReady = canUndo(engine);
  const unloadedRemain = hasUnloadedDice(engine);

  const logEntries = useMemo(
    () => [...engine.log].slice(-40).reverse(),
    [engine.log]
  );

  const greed = status === "greed" ? getGreedSummary(engine) : null;

  return (
    <main
      className="abyssa-expedition"
      data-ui-skin={activeUiSkin}
      data-ui-ornamented={activeUiSkin !== "timber" || undefined}
      data-attack-phase={attackFx?.phase}
      data-attack-lethal={attackFx?.lethal || undefined}
      data-support-kind={supportFx?.kind}
      data-support-phase={supportFx?.phase}
      data-enemy-turn-phase={enemyTurnFx?.phase}
      data-enemy-turn-result={enemyTurnFx?.result}
      data-layer-clear-pending={layerClearPending || undefined}
      aria-busy={
        isRolling ||
        Boolean(attackFx) ||
        Boolean(supportFx) ||
        phase === "enemy" ||
        layerClearPending
      }
      aria-label="裂隙远征战斗界面"
    >
      <div className="abyssa-expedition-frame abyssa-scene-panel">
        <button
          type="button"
          className="abyssa-expedition-skin-switch"
          onClick={cycleUiSkin}
          aria-label={`切换战斗界面风格，当前${activeUiSkinDefinition.label}，下一项${nextUiSkinDefinition.label}`}
        >
          <span className="abyssa-expedition-skin-switch__sigil" aria-hidden="true">
            {BATTLE_UI_SKINS.map((skin) => <i key={skin.id} data-skin={skin.id} />)}
          </span>
          <span className="abyssa-expedition-skin-switch__copy">
            <small>UI FRAME</small>
            <strong>{activeUiSkinDefinition.label}</strong>
          </span>
          <span className="abyssa-expedition-skin-switch__index" aria-hidden="true">
            {activeUiSkinIndex + 1}/{BATTLE_UI_SKINS.length}
          </span>
        </button>

        <header className="abyssa-expedition-frame__header">
          {activeUiSkinDefinition.topOrnamentUrl && (
            <img
              key={`${activeUiSkin}-top-left`}
              className="abyssa-expedition-frame__top-ornament abyssa-expedition-frame__top-ornament--left"
              src={activeUiSkinDefinition.topOrnamentUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
          <RpgHeader label="裂隙远征" variant="dark" />
          <span>ABYSSAL EXPEDITION</span>
          {activeUiSkinDefinition.topOrnamentUrl && (
            <img
              key={`${activeUiSkin}-top-right`}
              className="abyssa-expedition-frame__top-ornament abyssa-expedition-frame__top-ornament--right"
              src={activeUiSkinDefinition.topOrnamentUrl}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
          )}
        </header>

        <div className="abyssa-expedition-frame__shell">
          <FrameRails />
          {activeUiSkinDefinition.cornerOrnamentUrl && (
            <>
              {activeUiSkinDefinition.edgeWeave && (
                <FrameEdgeWeave namespace="abyssa-expedition-frame" />
              )}
              <BattleFrameCorners
                imageUrl={activeUiSkinDefinition.cornerOrnamentUrl}
                skin={activeUiSkin}
              />
            </>
          )}
          <div className="abyssa-expedition-frame__brass">
            <div className="abyssa-expedition-frame__board">
              <div className="abyssa-expedition-frame__interior">
                <div className="abyssa-expedition-regions__battlefield">
                  {/* ==================== 敌方区域 ==================== */}
                  <section className="abyssa-expedition-region abyssa-expedition-enemies" aria-label="敌方单位">
                    <span className="abyssa-expedition-enemies__haze" aria-hidden="true" />
                    <div
                      className="abyssa-expedition-enemies__formation"
                      style={{ gridTemplateColumns: `repeat(${Math.max(presentedEnemies.length, 1)}, 1fr)` }}
                    >
                      {presentedEnemies.map((enemy, enemyIndex) => {
                        const intent = enemy.intent;
                        const blocked = enemy.blocked;
                        const frenzyWarning = getFrenzyWarningRounds(engine, enemy);
                        const defeated = isEnemyDefeated(enemy);
                        const frenzyActive = isEnemyFrenzied(engine, enemy) && !defeated;
                        const enemyAttackFx =
                          attackFx?.targetId === enemy.id ? attackFx : null;
                        const enemyActionFx =
                          enemyTurnFx?.enemyId === enemy.id ? enemyTurnFx : null;
                        /* 拿着攻击/牵羊骰时敌人可点；拿着格挡骰时其攻击意图可点 */
                        const targetable =
                          interactive &&
                          heldVerb !== null &&
                          (heldVerb === "attack" || heldVerb === "wild" || heldVerb === "coin");
                        const intentBlockable =
                          interactive &&
                          intent?.type === "attack" &&
                          (heldVerb === "guard" || heldVerb === "wild");

                        return (
                          <article
                            className="abyssa-expedition-enemy"
                            data-art={enemy.art}
                            data-frenzied={frenzyActive || undefined}
                            data-frenzy-warning={frenzyWarning !== null || undefined}
                            data-frenzy-active={frenzyActive || undefined}
                            data-attack-phase={enemyAttackFx?.phase}
                            data-attack-lethal={enemyAttackFx?.lethal || undefined}
                            data-enemy-acting={Boolean(enemyActionFx) || undefined}
                            data-enemy-action-phase={enemyActionFx?.phase}
                            data-enemy-action-kind={enemyActionFx?.intentType}
                            data-defeated={defeated || undefined}
                            data-targetable={targetable || undefined}
                            ref={(node) => {
                              if (node) enemyNodesRef.current.set(enemy.id, node);
                              else enemyNodesRef.current.delete(enemy.id);
                            }}
                            style={{ animationDelay: `${enemyIndex * 70}ms` }}
                            key={enemy.id}
                            onClick={() => handleEnemyClick(enemy.id)}
                          >
                            {frenzyWarning !== null ? (
                              <span
                                className="abyssa-expedition-enemy__frenzy-status"
                                data-imminent={frenzyWarning === 0 || undefined}
                                role="status"
                                aria-label={`${enemy.name}狂暴预警：${
                                  frenzyWarning > 0
                                    ? `${frenzyWarning} 个完整回合后爆发`
                                    : "下回合爆发"
                                }，攻击将从 ${enemy.attack} 提升至 ${
                                  enemy.attack + FRENZY_ATTACK_BONUS
                                }`}
                              >
                                <small>狂暴预警</small>
                                <b>{frenzyWarning > 0 ? `${frenzyWarning} 回合` : "即将爆发"}</b>
                                <em>ATK {enemy.attack} → {enemy.attack + FRENZY_ATTACK_BONUS}</em>
                              </span>
                            ) : frenzyActive ? (
                              <span
                                className="abyssa-expedition-enemy__frenzy-status"
                                data-active="true"
                                role="status"
                                aria-label={`${enemy.name}正在狂暴：攻击 ${enemy.attack}，不可解除，持续至死亡`}
                              >
                                <small>狂暴中</small>
                                <b>持续至死亡</b>
                                <em>ATK {enemy.attack} · 不可解除</em>
                              </span>
                            ) : null}
                            <header>
                              <strong>{enemy.name}</strong>
                              <div className="abyssa-expedition-enemy__stats">
                                <span
                                  className="abyssa-expedition-enemy__health"
                                  aria-label={`生命 ${enemy.hp} / ${enemy.maxHp}`}
                                >
                                  {Array.from({ length: enemy.maxHp }, (_, index) => (
                                    <i data-filled={index < enemy.hp || undefined} key={index} />
                                  ))}
                                </span>
                                {enemy.attack > 0 && (
                                  <span className="abyssa-expedition-enemy__attack" aria-label={`攻击力 ${enemy.attack}`}>
                                    <small>ATK</small>
                                    <b>{enemy.attack}</b>
                                  </span>
                                )}
                              </div>
                              {intent && (
                                <button
                                  type="button"
                                  className="abyssa-expedition-intent"
                                  data-kind={intent.type}
                                  data-blockable={intentBlockable || undefined}
                                  data-threat={getIntentThreat(engine, enemy.id) ?? undefined}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (intentBlockable) handleIntentClick(enemy.id);
                                  }}
                                >
                                  <ExpeditionGlyph name={INTENT_GLYPH[intent.type]} />
                                  <b>
                                    {intent.type === "attack"
                                      ? Math.max(0, intent.value - blocked)
                                      : intent.title}
                                  </b>
                                </button>
                              )}
                            </header>
                            <img src={ENEMY_ART[enemy.art]} alt="" />
                            {enemyAttackFx && (
                              <>
                                <span className="abyssa-expedition-attack-fx" aria-hidden="true">
                                  <i className="abyssa-expedition-attack-flash" />
                                  <i className="abyssa-expedition-attack-slash" data-slash="one" />
                                  <i className="abyssa-expedition-attack-slash" data-slash="two" />
                                  <i className="abyssa-expedition-attack-burst" />
                                </span>
                                <output
                                  className="abyssa-expedition-attack-damage"
                                  aria-label={`${enemy.name}受到 ${enemyAttackFx.damage} 点伤害${
                                    enemyAttackFx.lethal ? "并被斩杀" : ""
                                  }`}
                                >
                                  <b>−{enemyAttackFx.damage}</b>
                                  {enemyAttackFx.lethal && <small>SLAIN</small>}
                                </output>
                              </>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    {/* 意图连线：敌人 → 目标队员 */}
                    <svg
                      className="abyssa-expedition-enemies__intent-lines"
                      viewBox={`0 0 ${INTENT_VIEW_WIDTH} 310`}
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {presentedEnemies.map((enemy, index) => {
                        const intent = enemy.intent;
                        if (!intent || !("targetId" in intent)) return null;
                        const fromX = enemyAnchorX(index, presentedEnemies.length);
                        const targetX = partyAnchorX(intent.targetId);
                        /* 红=致死 / 黄=掉血不致死 / 灰=已挡尽，全部派生自状态，undo 自动回退 */
                        const threat = getIntentThreat(engine, enemy.id);
                        const path = `M ${fromX} 260 L ${targetX} 346`;

                        return (
                          <g
                            data-kind={intent.type}
                            data-threat={threat ?? undefined}
                            data-resolving={enemyTurnFx?.enemyId === enemy.id || undefined}
                            key={`${enemy.id}-line`}
                          >
                            <path className="abyssa-expedition-intent-line__shadow" d={path} />
                            <path className="abyssa-expedition-intent-line__body" d={path} />
                          </g>
                        );
                      })}
                      {presentedEnemies.map((enemy, index) =>
                        enemy.intent && "targetId" in enemy.intent ? (
                          <circle
                            className="abyssa-expedition-intent-line__socket"
                            cx={enemyAnchorX(index, presentedEnemies.length)}
                            cy="260"
                            r="5"
                            key={`${enemy.id}-socket`}
                          />
                        ) : null
                      )}
                    </svg>
                  </section>

                  {/* ==================== 我方区域 ==================== */}
                  <section className="abyssa-expedition-region abyssa-expedition-party" aria-label="我方区域">
                    <div className="abyssa-expedition-party__cards">
                      {engine.party.map((member) => {
                        const visual = PARTY_VISUALS[member.id];
                        const held = heldActor === member.id;
                        const attacking = attackFx?.actorId === member.id;
                        const supporting = supportFx?.actorId === member.id;
                        const memberSupportFx =
                          supportFx?.targetId === member.id ? supportFx : null;
                        const memberEnemyFx =
                          enemyTurnFx?.intentType === "attack" &&
                          enemyTurnFx.targetId === member.id
                            ? enemyTurnFx
                            : null;
                        /* 最后一颗心先完整熄灭，力竭灰化从 recover 才开始。 */
                        const deferDownedVisual = Boolean(
                          memberEnemyFx?.lethal && memberEnemyFx.phase === "impact"
                        );
                        const visuallyDowned = member.downed && !deferDownedVisual;
                        const enemyHitResultVisible = Boolean(
                          memberEnemyFx &&
                          (memberEnemyFx.phase === "impact" ||
                            memberEnemyFx.phase === "recover")
                        );
                        const ready = canActWith(engine, member.id);
                        const incoming = getIncomingDamageFor(engine, member.id);
                        const targeted = incoming.raw > 0 && !member.downed;
                        const safe = targeted && incoming.final <= 0;
                        /* 正拿着治疗骰时，残血队友高亮为可施放目标 */
                        const healable =
                          interactive &&
                          heldVerb === "heal" &&
                          !held &&
                          !member.downed &&
                          member.hp < MAX_HP;

                        /* 骰子一装载曲线就通电；拿起后再加强 */
                        const linked = ready || held || attacking || supporting;

                        return (
                          <div
                            className="abyssa-expedition-party-column"
                            data-active={linked || undefined}
                            data-held={held || undefined}
                            data-attacking={attacking || undefined}
                            data-supporting={supporting || undefined}
                            key={member.id}
                          >
                            <article
                              className="abyssa-expedition-party-card"
                              data-character={member.id}
                              data-tone={visual.tone}
                              data-downed={visuallyDowned || undefined}
                              data-enemy-hit-phase={memberEnemyFx?.phase}
                              data-enemy-hit-result={memberEnemyFx?.result}
                              data-enemy-hit-lethal={memberEnemyFx?.lethal || undefined}
                              data-targeted={(targeted && !safe) || undefined}
                              data-safe={safe || undefined}
                              data-healable={healable || undefined}
                              data-held={held || undefined}
                              data-attacking={attacking || undefined}
                              data-supporting={supporting || undefined}
                              data-support-kind={memberSupportFx?.kind}
                              data-support-phase={memberSupportFx?.phase}
                              data-ready={(ready && !held) || undefined}
                              data-clickable={
                                (interactive && !member.downed && (ready || Boolean(heldActor))) ||
                                undefined
                              }
                              aria-label={`${visual.name}：生命 ${member.hp} / ${MAX_HP}${
                                member.downed
                                  ? `，力竭倒下，本层无法行动，下一层以 ${DOWNED_RETURN_HP} 点生命重整`
                                  : ready
                                    ? "，待指挥"
                                    : ""
                              }`}
                              onClick={() => handleMemberCardClick(member.id)}
                            >
                              <span className="abyssa-expedition-party-card__crest" aria-hidden="true" />
                              {memberEnemyFx && (
                                <output
                                  className="abyssa-expedition-enemy-hit-fx"
                                  data-result={memberEnemyFx.result}
                                  aria-live={
                                    memberEnemyFx.phase === "impact" ? "polite" : undefined
                                  }
                                  aria-label={enemyHitResultVisible
                                    ? memberEnemyFx.result === "hit"
                                      ? `${visual.name}受到 ${memberEnemyFx.damage} 点伤害`
                                      : memberEnemyFx.result === "blocked"
                                        ? `${visual.name}完全挡下${memberEnemyFx.enemyName}的攻击`
                                        : `${memberEnemyFx.enemyName}对${visual.name}的攻击落空`
                                    : undefined}
                                  key={memberEnemyFx.actionId}
                                >
                                  <span className="abyssa-expedition-enemy-hit-fx__flash" aria-hidden="true" />
                                  <span className="abyssa-expedition-enemy-hit-fx__impact" aria-hidden="true" />
                                  <strong
                                    className="abyssa-expedition-enemy-hit-fx__damage"
                                    aria-hidden="true"
                                  >
                                    {enemyHitResultVisible
                                      ? memberEnemyFx.result === "hit"
                                        ? `−${memberEnemyFx.damage}`
                                        : memberEnemyFx.result === "blocked"
                                          ? "BLOCK"
                                          : "MISS"
                                      : null}
                                  </strong>
                                </output>
                              )}
                              {memberSupportFx && (
                                <output
                                  className="abyssa-expedition-support-fx"
                                  data-kind={memberSupportFx.kind}
                                  data-phase={memberSupportFx.phase}
                                  aria-label={
                                    memberSupportFx.kind === "guard"
                                      ? `${visual.name}获得 ${memberSupportFx.amount} 层盾牌`
                                      : `${visual.name}恢复 ${memberSupportFx.amount} 点生命`
                                  }
                                >
                                  <span className="abyssa-expedition-support-fx__halo" aria-hidden="true" />
                                  <span className="abyssa-expedition-support-fx__emblem" aria-hidden="true" />
                                  {memberSupportFx.kind === "heal" &&
                                    Array.from({ length: 5 }, (_, particle) => (
                                      <span
                                        className="abyssa-expedition-support-fx__particle"
                                        data-particle={particle + 1}
                                        aria-hidden="true"
                                        key={particle}
                                      />
                                    ))}
                                  <strong aria-hidden="true">+{memberSupportFx.amount}</strong>
                                </output>
                              )}
                              <div className="abyssa-expedition-party-card__portrait">
                                <span className="abyssa-expedition-party-card__portrait-pattern" aria-hidden="true" />
                                <img src={visual.portrait} alt={`${visual.name}立绘`} />
                                {visuallyDowned && (
                                  <span className="abyssa-expedition-party-card__downed-label">力竭</span>
                                )}
                                <div className="abyssa-expedition-party-card__health">
                                  <span
                                    className="abyssa-expedition-party-card__shield"
                                    data-empty={member.shield === 0 || undefined}
                                    aria-label={`盾牌 ${member.shield} 层`}
                                  >
                                    {member.shield}
                                  </span>
                                  <span
                                    className="abyssa-expedition-party-card__hearts"
                                    aria-label={`生命 ${member.hp} / ${MAX_HP}`}
                                  >
                                    {Array.from({ length: MAX_HP }, (_, slot) => (
                                      (() => {
                                        const lostHeart = Boolean(
                                          memberEnemyFx?.result === "hit" &&
                                          memberEnemyFx.hpBefore !== null &&
                                          memberEnemyFx.hpAfter !== null &&
                                          slot >= memberEnemyFx.hpAfter &&
                                          slot < memberEnemyFx.hpBefore
                                        );
                                        const lostOrder =
                                          lostHeart &&
                                          memberEnemyFx &&
                                          memberEnemyFx.hpBefore !== null
                                            ? memberEnemyFx.hpBefore - 1 - slot
                                            : undefined;

                                        return (
                                          <i
                                            data-filled={slot < member.hp || undefined}
                                            data-pending-damage={
                                              phase === "act" &&
                                              slot < member.hp &&
                                              slot >= member.hp - incoming.final
                                                ? true
                                                : undefined
                                            }
                                            data-lost-heart={lostHeart || undefined}
                                            data-lost-order={lostOrder}
                                            key={slot}
                                          />
                                        );
                                      })()
                                    ))}
                                  </span>
                                </div>
                              </div>
                              <div className="abyssa-expedition-party-card__skills" aria-label={`${visual.name}的饰品`}>
                                {[0, 1, 2, 3].map((slot) => {
                                  const skill = visual.skills[slot];
                                  return (
                                    <span data-empty={!skill || undefined} key={`${member.id}-${slot}`} aria-hidden="true">
                                      {skill && <i data-icon={skill} />}
                                    </span>
                                  );
                                })}
                              </div>
                            </article>
                            <div className="abyssa-expedition-party-nameplate" data-targeted={(targeted && !safe) || undefined}>
                              <strong>{visual.nameplate}</strong>
                            </div>
                            <AnimatedPartyLink active={linked} />
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* ==================== 骰池 ==================== */}
                  <section className="abyssa-expedition-region abyssa-expedition-dice-panel" aria-label="骰子区域">
                    <span className="abyssa-expedition-dice-panel__corners" aria-hidden="true">
                      <i data-corner="tl" />
                      <i data-corner="tr" />
                      <i data-corner="br" />
                      <i data-corner="bl" />
                    </span>
                    <div className="abyssa-expedition-dice-panel__tray">
                      <span className="abyssa-expedition-dice-panel__pattern" aria-hidden="true" />
                      <div className="abyssa-expedition-dice-panel__row">
                        {PARTY_ORDER.map((ownerId, slotIndex) => {
                          const dieIndex = engine.dice.findIndex((item) => item.ownerId === ownerId);
                          const die = engine.dice[dieIndex]!;
                          const member = engine.party.find((item) => item.id === ownerId)!;
                          const visual = PARTY_VISUALS[ownerId];
                          const dieVisual = visuals[ownerId];
                          const value = die.faceIndex !== null ? die.faceIndex + 1 : 1;
                          const rustFaceCount = getRustFaceCount(ownerId, member.rustLevel);
                          const gildFaceCount = getGildFaceCount(ownerId, member.rustLevel);
                          const deferDownedVisual = Boolean(
                            enemyTurnFx?.intentType === "attack" &&
                            enemyTurnFx.targetId === ownerId &&
                            enemyTurnFx.lethal &&
                            enemyTurnFx.phase === "impact"
                          );
                          const visuallyDowned = member.downed && !deferDownedVisual;

                          return (
                            <div
                              className="abyssa-expedition-die-slot"
                              data-owner={ownerId}
                              data-slot={slotIndex + 1}
                              data-downed={visuallyDowned || undefined}
                              data-rust-faces={rustFaceCount || undefined}
                              data-gild-faces={gildFaceCount || undefined}
                              data-sealed={die.sealed || undefined}
                              data-loaded={die.loaded || undefined}
                              data-spent={die.spent || undefined}
                              data-unrolled={die.faceIndex === null || undefined}
                              style={{ gridColumn: slotIndex + 1 }}
                              key={ownerId}
                            >
                              <ExpeditionDie3D
                                index={slotIndex}
                                value={value}
                                characterName={visual.name}
                                themeColor={visual.themeColor}
                                suit={visual.suit}
                                faces={buildDieFaces(ownerId, member.rustLevel)}
                                held={die.loaded}
                                scoring={scoringOwners.has(ownerId)}
                                rolling={dieVisual.rolling}
                                rollDuration={dieVisual.rollDuration}
                                rotation={dieVisual.rotation}
                                disabled={
                                  member.downed ||
                                  !interactive ||
                                  !canToggleLoad(engine, dieIndex)
                                }
                                downed={visuallyDowned}
                                rustFaces={rustFaceCount}
                                gildFaces={gildFaceCount}
                                onToggle={() => handleDieToggle(dieIndex)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <ActionDock
                      active
                      busy={
                        isRolling ||
                        Boolean(attackFx) ||
                        Boolean(supportFx) ||
                        phase === "enemy"
                      }
                    >
                      {/* 菱形撑回：紧挨操作栅左侧，不占内部栅格 */}
                      <IconButton
                        className="abyssa-expedition-undo"
                        label={undoLabel ? `撤回：${undoLabel}` : "撤回"}
                        shape="diamond"
                        size="md"
                        variant="dark"
                        disabled={!interactive || !undoReady}
                        onClick={handleUndo}
                      >
                        <svg viewBox="0 0 512 512" aria-hidden="true">
                          <path d="M248.91 50a205.9 205.9 0 0 1 35.857 3.13c85.207 15.025 152.077 81.895 167.102 167.102 15.023 85.208-24.944 170.917-99.874 214.178-32.782 18.927-69.254 27.996-105.463 27.553-46.555-.57-92.675-16.865-129.957-48.15l30.855-36.768a157.846 157.846 0 0 0 180.566 15.797 157.846 157.846 0 0 0 76.603-164.274A157.848 157.848 0 0 0 276.429 100.4a157.84 157.84 0 0 0-139.17 43.862L185 192H57V64l46.34 46.342C141.758 71.962 194.17 50.03 248.91 50z" />
                        </svg>
                      </IconButton>
                      <div className="abyssa-expedition-action-controls">
                        <DiceActionButton
                          label="REROLL"
                          disabled={!interactive || engine.rerollsRemaining <= 0 || !unloadedRemain}
                          onClick={handleReroll}
                        />
                        <ActionDockSlot
                          caption="REROLL"
                          label={`重掷剩余 ${engine.rerollsRemaining} 次`}
                          value={`×${engine.rerollsRemaining}`}
                        />
                        <ExpeditionHandReadout hand={hand} />
                        <DiceActionButton
                          label="END TURN"
                          primary
                          disabled={!interactive}
                          onClick={handleEndTurn}
                        />
                      </div>
                    </ActionDock>
                  </section>
                </div>

                {/* ==================== 侧栏 ==================== */}
                <aside className="abyssa-expedition-region abyssa-expedition-sidebar" aria-label="远征账本">
                  <span className="abyssa-expedition-sidebar__corners" aria-hidden="true">
                    <i data-corner="tl" />
                    <i data-corner="tr" />
                    <i data-corner="br" />
                    <i data-corner="bl" />
                  </span>

                  <header className="abyssa-expedition-sidebar__header">
                    <span>RIFT YIELD</span>
                    <small>
                      {engine.location} · 第 {engine.layer}/{MAX_LAYER} 层 · 回合 {engine.round}
                    </small>
                  </header>

                  <section
                    className="abyssa-expedition-multiplier"
                    data-finalizing={layerClearPending || undefined}
                    aria-label={`本层散金 ${engine.gold}，牌型倍率 ${handFactor.toFixed(2)}${layerClearPending ? "（已计入最后回合）" : ""}，第 ${engine.layer} 层基础倍率 ${layerFactor}，本层预计入袋 ${projected}`}
                  >
                    <div className="abyssa-expedition-sidebar__section-title">
                      <span>
                        {layerClearPending
                          ? "FINAL PAYOUT · 本回合已计入"
                          : "CUMULATIVE MULTIPLIER"}
                      </span>
                    </div>
                    <ExpeditionOdometer
                      className="abyssa-expedition-multiplier__reels"
                      value={handFactor * layerFactor}
                      digits={2}
                      decimals={2}
                      prefix="×"
                      label={`当前总倍率 ${(handFactor * layerFactor).toFixed(2)}`}
                    />
                    <div className="abyssa-expedition-multiplier__breakdown">
                      <span>{layerClearPending ? "最终牌型" : "牌型"} ×{handFactor.toFixed(2)}</span>
                      <i aria-hidden="true">·</i>
                      <span>第 {engine.layer} 层 ×{layerFactor}</span>
                    </div>
                    <div className="abyssa-expedition-multiplier__amounts">
                      <div data-currency="gold" data-value="base"><strong>{engine.gold.toLocaleString()}</strong></div>
                      <i aria-hidden="true">→</i>
                      <div data-currency="gold" data-value="result"><strong>{projected.toLocaleString()}</strong></div>
                    </div>
                  </section>

                  <span className="abyssa-expedition-sidebar__divider" aria-hidden="true"><i /></span>

                  <section className="abyssa-expedition-purse" aria-label={`包裹 ${engine.bagGold} 金币，本层散金 ${engine.gold} 金币`}>
                    <div className="abyssa-expedition-purse__heading">
                      <strong>BAG &amp; MATERIALS</strong>
                      <small>AUREI</small>
                    </div>
                    <span className="abyssa-expedition-purse__divider" aria-hidden="true" />
                    <div className="abyssa-expedition-purse__amount">
                      <div className="abyssa-expedition-purse__currency" data-kind="gold">
                        <ExpeditionBagOdometer
                          value={engine.bagGold}
                          label={`包裹 ${engine.bagGold} 枚金币`}
                        />
                      </div>
                      <span className="abyssa-expedition-purse__currency-divider" aria-hidden="true" />
                      <div className="abyssa-expedition-purse__currency" data-kind="crystal">
                        <CurrencyAmount
                          value={engine.result?.crystal ? 1 : 0}
                          currency="crystal"
                          label={`${engine.result?.crystal ? 1 : 0} 枚远古晶石`}
                        />
                      </div>
                    </div>
                    <div className="abyssa-expedition-loot" role="region" aria-label="层区倍率" tabIndex={0}>
                      <div className="abyssa-expedition-loot__list">
                        {LAYER_MULTIPLIERS.map((layerMultiplier, index) => (
                          <div
                            className="abyssa-expedition-loot__item"
                            data-current={index + 1 === engine.layer || undefined}
                            data-passed={index + 1 < engine.layer || undefined}
                            key={index}
                          >
                            <i data-icon={index + 1 <= engine.deepestLayer ? "crystal" : "ore"} aria-hidden="true" />
                            <span>第 {index + 1} 层</span>
                            <strong>×{layerMultiplier}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="abyssa-expedition-battle-log" aria-label="战斗日志">
                    <header>BATTLE LOG</header>
                    <ol>
                      {logEntries.map((entry, index) => (
                        <li key={`${entry.layer}-${entry.round}-${index}`}>
                          <time>{`L${entry.layer}R${entry.round}`}</time>
                          <span>
                            <b data-tone={LOG_TONE_COLOR[entry.tone] ?? "system"}>{entry.text}</b>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== 贪心弹窗 ==================== */}
      {greed && (
        <div className="abyssa-expedition-overlay" role="dialog" aria-modal="true" aria-label="继续深入？">
          <div className="abyssa-expedition-modal" data-wide>
            <h3>继续深入？</h3>
            <div className="abyssa-expedition-modal__body">
              <p>
                第 {engine.layer} 层战利品已全部结算入包裹
              </p>
              {engine.lastLayerSettlement && (
                <LayerSettlementBreakdown settlement={engine.lastLayerSettlement} />
              )}
              <p className="abyssa-expedition-modal__highlight">
                现在离场可带回 <strong data-currency="gold">{greed.bagTotal}G</strong>
              </p>
              <p>
                下一层（第 {greed.nextLayer} 层）收益倍率 <strong>×{greed.nextLayerMultiplier}</strong>
              </p>
              {greed.downedCount > 0 && (
                <p data-tone="bad">
                  有 {greed.downedCount} 人力竭；深入后将半血重整，命数锈蚀不会恢复。
                </p>
              )}
              {greed.rustedFaceCount > 0 && (
                <p data-tone="bad">全队命数骰当前共有 {greed.rustedFaceCount} 个锈面。</p>
              )}
              {greed.woundedCount > 0 && (
                <p data-tone="bad">另有 {greed.woundedCount} 人未满血。</p>
              )}
              <p data-tone="dim">
                {greed.crystalHint
                  ? "深度达到 3 后，离场时有机会取得远古晶石。"
                  : "继续深入会提高收益，也会出现更复杂的公开意图。"}
              </p>
            </div>
            <div className="abyssa-expedition-modal__actions">
              <DiceActionButton
                label="再深一层"
                primary
                onClick={handleGoDeeper}
              />
              <DiceActionButton
                label="带宝离场"
                onClick={handleLeaveExpedition}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== 结算弹窗 ==================== */}
      {status === "finished" && engine.result && (
        <div className="abyssa-expedition-overlay" role="dialog" aria-modal="true" aria-label="远征结算">
          <div className="abyssa-expedition-modal" data-wide>
            <h3>{engine.result.wiped ? "强行撤离" : "远征结束"}</h3>
            <div className="abyssa-expedition-modal__body">
              <p>
                {engine.result.wiped
                  ? `包裹 ${engine.result.baseGold}G 损失一半，当前层收益全部丢失`
                  : `包裹合计（各层独立结算之和）`}
              </p>
              {!engine.result.wiped && engine.lastLayerSettlement && (
                <LayerSettlementBreakdown settlement={engine.lastLayerSettlement} />
              )}
              <p className="abyssa-expedition-modal__total" data-currency="gold">＋{engine.result.totalGold} G</p>
              <p>
                最深抵达第 {engine.result.deepestLayer} 层
                {engine.result.crystal ? " · 远古晶石 ×1" : ""}
              </p>
              {engine.facts.length > 0 && (
                <div className="abyssa-expedition-modal__facts">
                  <header>事实海关 · 供战报与餐桌话题</header>
                  <ul>
                    {engine.facts.map((fact) => (
                      <li key={fact}>▹ {fact}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="abyssa-expedition-modal__actions">
              <DiceActionButton label="再来一局" primary onClick={handleRestart} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
