import { useMemo, useState } from "react";
import {
  DOWNED_RETURN_HP,
  FRENZY_ATTACK_BONUS,
  LAYER_MULTIPLIERS,
  MAX_HP,
  canActWith,
  canToggleLoad,
  canUndo,
  evaluateHand,
  getFrenzyWarningRounds,
  getIncomingDamageFor,
  getIntentThreat,
  isEnemyFrenzied,
  isEnemyDefeated,
  getLayerPayout,
  getStateFace,
  getUndoLabel,
  hasUnloadedDice,
  type BattleTransition,
  type CharacterId,
  type Rng
} from "./engine";
import {
  getPlayerAttackCue,
  getPlayerSupportCue
} from "./controller/presentation-events";
import { useExpeditionBattleController } from "./controller/useExpeditionBattleController";
import { ExpeditionGlyph } from "./ExpeditionGlyph";
import {
  getNextBattleUiSkin,
  type BattleUiSkin
} from "./battleUiSkins";
import {
  ENEMY_ART,
  INTENT_GLYPH,
  PARTY_VISUALS,
  PIP_SLOTS
} from "./presentation/expedition-visuals";
import {
  INTENT_VIEW_WIDTH,
  enemyAnchorX,
  getEnemyTargetCommand,
  getMemberTargetCommand,
  partyAnchorX
} from "./presentation/battle-view-model";
import { AnimatedPartyLink } from "./presentation/ExpeditionBattleChrome";
import { useExpeditionBattlePresentation } from "./presentation/useExpeditionBattlePresentation";
import { ExpeditionBattleSidebar } from "./presentation/ExpeditionBattleSidebar";
import { ExpeditionBattleOverlays } from "./presentation/ExpeditionBattleOverlays";
import { ExpeditionDicePanel } from "./presentation/ExpeditionDicePanel";
import { ExpeditionBattleFrame } from "./presentation/ExpeditionBattleFrame";

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
  const battlePresentation = useExpeditionBattlePresentation(controller);
  const engine = controller.state;
  const heldActor = controller.heldActor;
  const commitTransition = controller.commitTransition;
  const setHeldActor = controller.holdActor;
  const transition = controller.transition;
  const {
    phase,
    status,
    layerClearPending,
    interactive,
    canInitialRoll,
    isRolling,
    visuals,
    attackFx,
    supportFx,
    enemyTurnFx,
    presentedEnemies,
    registerEnemyNode,
    isBusy: isPresentationBusy,
    animateDice,
    playPlayerAttack,
    playPlayerSupport,
    playEnemyTurn,
    resetPresentation
  } = battlePresentation;
  const [internalUiSkin, setInternalUiSkin] = useState<BattleUiSkin>(defaultUiSkin);

  const activeUiSkin = uiSkin ?? internalUiSkin;
  const nextUiSkin = getNextBattleUiSkin(activeUiSkin);

  const cycleUiSkin = () => {
    if (uiSkin === undefined) setInternalUiSkin(nextUiSkin);
    onUiSkinChange?.(nextUiSkin);
  };

  /* ---------- 骰子：多选装载 ---------- */

  const handleDieToggle = (index: number) => {
    if (
      !interactive ||
      isPresentationBusy() ||
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

  const handleInitialRoll = () => {
    if (
      !canInitialRoll ||
      status !== "active" ||
      engine.mode.type !== "awaiting-roll" ||
      isPresentationBusy()
    ) {
      return;
    }
    const result = transition({ type: "roll-dice" }, engine);
    if (result.error) return;
    animateDice(result.state);
    commitTransition(result);
    setHeldActor(null);
  };

  /* ---------- 重掷：不可撤销，会清空撤销栈 ---------- */

  const handleReroll = () => {
    if (
      !interactive ||
      isPresentationBusy() ||
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
      isPresentationBusy() ||
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
      isPresentationBusy()
    ) {
      return;
    }
    void playEnemyTurn();
  };

  /* ---------- 角色卡：拿起 / 放下 ---------- */

  const handleMemberCardClick = (memberId: CharacterId) => {
    if (!interactive || isPresentationBusy()) return;

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
    if (result.error || isPresentationBusy()) return;

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
      isPresentationBusy()
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
      void playPlayerAttack(result, attack);
      return;
    }

    applyAction(result);
  };

  const handleIntentClick = (enemyId: string) => {
    if (
      !interactive ||
      !heldActor ||
      isPresentationBusy()
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

  const handleRestart = () => resetPresentation();

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
      <ExpeditionBattleFrame skin={activeUiSkin} onCycleSkin={cycleUiSkin}>
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
                            ref={(node) => registerEnemyNode(enemy.id, node)}
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

                  <ExpeditionDicePanel
                    engine={engine}
                    visuals={visuals}
                    enemyTurnFx={enemyTurnFx}
                    scoringOwners={scoringOwners}
                    interactive={interactive}
                    initialRollReady={canInitialRoll}
                    busy={isRolling || phase === "enemy"}
                    attackFx={attackFx}
                    supportFx={supportFx}
                    hand={hand}
                    undoLabel={undoLabel}
                    undoReady={undoReady}
                    unloadedRemain={unloadedRemain}
                    onDieToggle={handleDieToggle}
                    onUndo={handleUndo}
                    onRoll={handleInitialRoll}
                    onReroll={handleReroll}
                    onEndTurn={handleEndTurn}
                  />
                </div>

                <ExpeditionBattleSidebar
                  engine={engine}
                  layerClearPending={layerClearPending}
                  handFactor={handFactor}
                  layerFactor={layerFactor}
                  projected={projected}
                />
      </ExpeditionBattleFrame>

      <ExpeditionBattleOverlays
        engine={engine}
        onGoDeeper={handleGoDeeper}
        onLeaveExpedition={handleLeaveExpedition}
        onRestart={handleRestart}
      />
    </main>
  );
}
