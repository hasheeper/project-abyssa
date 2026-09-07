import { useState, type CSSProperties, type ReactNode } from "react";
import { FRENZY_ATTACK_BONUS } from "../view";
import { ExpeditionGlyph } from "../ExpeditionGlyph";
import { getNextBattleUiSkin, resolveBattleUiSkin } from "../battleUiSkins";
import type { ExpeditionBattleScreenProps } from "../ExpeditionBattleScreen";
import { INTENT_GLYPH, PARTY_VISUALS } from "./expedition-visuals";
import { INTENT_VIEW_WIDTH, enemyAnchorX, partyAnchorX } from "./battle-view-model";
import { AnimatedPartyLink } from "./ExpeditionBattleChrome";
import { ExpeditionBattleFrame } from "./ExpeditionBattleFrame";
import { EnemyMist } from "./EnemyMist";
import { JOURNEY_MOTION_MS, type JourneyMotion } from "./journey-motion";
import type { BattleSurfaceMember, BattleSurfaceEnemy, BattleEnemyFx } from "./battle-surface-model";
import type { PlayerAttackFx, PlayerSupportFx } from "./useExpeditionBattlePresentation";

type Props = ExpeditionBattleScreenProps & {
  label: string; party: BattleSurfaceMember[]; presentedEnemies: BattleSurfaceEnemy[];
  phase: string; layerClearPending: boolean; isRolling: boolean; interactive: boolean;
  heldActor: string | null; attackFx: PlayerAttackFx | null; supportFx: PlayerSupportFx | null; enemyTurnFx: BattleEnemyFx | null;
  registerEnemyNode: (id: string, node: HTMLElement | null) => void;
  isPresentationBusy: () => boolean;
  handleMemberCardClick: (id: string) => void; handleEnemyClick: (id: string) => void; handleIntentClick: (id: string) => void;
  dicePanel: ReactNode; sidebar: ReactNode; overlays: ReactNode; sceneStyle?: CSSProperties; title?: string;
  journey?: { content: ReactNode; key: string; label: string };
  journeyMotion?: JourneyMotion | null;
  partyChoice?: { selectedId: string; disabled: boolean; onSelect: (id: string) => void };
};
/** The approved battle markup, shared by content versions. No game rules live here. */
export function ExpeditionBattleSurface({
  inspectHref, saving = false, uiSkin, defaultUiSkin = "timber", onUiSkinChange,
  label, party, presentedEnemies, phase, layerClearPending, isRolling, interactive,
  heldActor, attackFx, supportFx, enemyTurnFx, registerEnemyNode, isPresentationBusy,
  handleMemberCardClick, handleEnemyClick, handleIntentClick, dicePanel, sidebar, overlays, sceneStyle, title,
  journey, journeyMotion, partyChoice,
}: Props) {
  const [internalUiSkin, setInternalUiSkin] = useState(defaultUiSkin);
  const activeUiSkin = uiSkin ?? internalUiSkin;
  const nextUiSkin = getNextBattleUiSkin(activeUiSkin);
  const cycleUiSkin = () => {
    if (uiSkin === undefined) setInternalUiSkin(nextUiSkin);
    onUiSkinChange?.(nextUiSkin);
  };
  return (
    <main
      className="abyssa-expedition"
      style={{
        "--party-size": party.length,
        "--journey-walk-ms": `${JOURNEY_MOTION_MS.walking}ms`,
        "--journey-arrive-ms": `${JOURNEY_MOTION_MS.arriving}ms`,
        "--journey-encounter-ms": `${JOURNEY_MOTION_MS.encounter}ms`,
        "--journey-flash-ms": `${JOURNEY_MOTION_MS.flash}ms`,
        "--journey-reveal-ms": `${JOURNEY_MOTION_MS.revealing}ms`,
      } as CSSProperties}
      data-ui-skin={activeUiSkin}
      data-ui-ornamented={activeUiSkin !== "timber" || undefined}
      data-dice-rolling={isRolling || undefined}
      data-attack-phase={attackFx?.phase}
      data-attack-lethal={attackFx?.lethal || undefined}
      data-support-kind={supportFx?.kind}
      data-support-phase={supportFx?.phase}
      data-enemy-turn-phase={enemyTurnFx?.phase}
      data-enemy-turn-result={enemyTurnFx?.result}
      data-layer-clear-pending={layerClearPending || undefined}
      data-journey-motion={journeyMotion || undefined}
      data-journey-node={journey ? true : undefined}
      aria-busy={
        isRolling ||
        Boolean(attackFx) ||
        Boolean(supportFx) ||
        phase === "enemy" ||
        layerClearPending || Boolean(journeyMotion)
      }
      aria-label={label}
    >
      <ExpeditionBattleFrame title={title} skin={activeUiSkin} onCycleSkin={cycleUiSkin}>
        <div className="abyssa-expedition-regions__battlefield">
                  {/* ==================== 敌方区域 ==================== */}
                  <section className="abyssa-expedition-region abyssa-expedition-enemies" aria-label={journey?.label ?? "敌方单位"} style={sceneStyle ? {...sceneStyle, backgroundImage: "none"} : undefined}>
                    {sceneStyle && <div className="abyssa-expedition-scene-clip" aria-hidden="true"><div className="abyssa-expedition-scene" style={sceneStyle}/></div>}
                    <span className="abyssa-expedition-enemies__haze" aria-hidden="true" />
                    {resolveBattleUiSkin(activeUiSkin).enemyAtmosphere === "mist" && <EnemyMist foregroundBusy={isRolling || journeyMotion === "encounter" || journeyMotion === "flash"} />}
                    {journey && <div className="abyssa-expedition-journey-content" key={journey.key}>{journey.content}</div>}
                    {(journeyMotion === "flash" || journeyMotion === "revealing") && <span className="abyssa-expedition-encounter-flash" aria-hidden="true" />}
                    <div
                      className="abyssa-expedition-enemies__formation"
                      style={{ gridTemplateColumns: `repeat(${Math.max(presentedEnemies.length, 1)}, 1fr)` }}
                    >
                      {presentedEnemies.map((enemy, enemyIndex) => {
                        const intent = enemy.intent;
                        const blocked = enemy.blocked;
                        const frenzyWarning = enemy.frenzyWarning;
                        const defeated = enemy.defeated;
                        const frenzyActive = enemy.frenzyActive && !defeated;
                        const enemyAttackFx =
                          attackFx?.targetId === enemy.id ? attackFx : null;
                        const enemyActionFx =
                          enemyTurnFx?.enemyId === enemy.id ? enemyTurnFx : null;
                        /* 拿着攻击/牵羊骰时敌人可点；拿着格挡骰时其攻击意图可点 */
                        const targetable =
                          interactive && enemy.targetable;
                        const intentBlockable =
                          interactive && enemy.intentBlockable;

                        return (
                          <article
                            className="abyssa-expedition-enemy"
                            data-enemy-id={enemy.id}
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
                                  data-threat={enemy.threat ?? undefined}
                                  title={intent.description}
                                  aria-label={intent.description}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    if (intentBlockable) handleIntentClick(enemy.id);
                                  }}
                                >
                                  <ExpeditionGlyph name={INTENT_GLYPH[intent.type] ?? "art"} />
                                  <b>
                                    {intent.type === "attack"
                                      ? Math.max(0, (intent.value ?? 0) - blocked)
                                      : intent.title}
                                  </b>
                                </button>
                              )}
                            </header>
                            <img src={enemy.artUrl} style={enemy.artStyle} alt="" />
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
                        if (!intent?.targetId || !party.some(m => m.id === intent.targetId)) return null;
                        const fromX = enemyAnchorX(index, presentedEnemies.length);
                        const targetX = partyAnchorX(intent.targetId, party.map(member => member.id));
                        /* 红=致死 / 黄=掉血不致死 / 灰=已挡尽，全部派生自状态，undo 自动回退 */
                        const threat = enemy.threat;
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
                        enemy.intent?.targetId && party.some(m => m.id === enemy.intent?.targetId) ? (
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
                      {party.map((member) => {
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
                        const ready = member.ready;
                        const incoming = member.incoming;
                        const targeted = incoming.raw > 0 && !member.downed;
                        const safe = targeted && incoming.final <= 0;
                        /* 正拿着治疗骰时，残血队友高亮为可施放目标 */
                        const healable =
                          interactive && member.healable;

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
                              data-event-selectable={partyChoice && !member.downed && !partyChoice.disabled || undefined}
                              data-event-selected={partyChoice?.selectedId === member.id || undefined}
                              role={partyChoice ? "button" : undefined}
                              tabIndex={partyChoice && !member.downed && !partyChoice.disabled ? 0 : undefined}
                              aria-pressed={partyChoice ? partyChoice.selectedId === member.id : undefined}
                              aria-disabled={partyChoice ? member.downed || partyChoice.disabled : undefined}
                              data-attacking={attacking || undefined}
                              data-supporting={supporting || undefined}
                              data-support-kind={memberSupportFx?.kind}
                              data-support-phase={memberSupportFx?.phase}
                              data-ready={(ready && !held) || undefined}
                              data-clickable={
                                (interactive && !member.downed && (ready || Boolean(heldActor))) ||
                                undefined
                              }
                              aria-label={`${visual.name}：生命 ${member.hp} / ${member.maxHp}${
                                member.downed
                                  ? `，力竭倒下，本层无法行动，下一层以 ${member.returnHp} 点生命重整`
                                  : ready
                                    ? "，待指挥"
                                    : ""
                              }`}
                              onClick={() => {
                                if (partyChoice) {if (!partyChoice.disabled && !member.downed) partyChoice.onSelect(member.id);}
                                else handleMemberCardClick(member.id);
                              }}
                              onKeyDown={partyChoice ? event => {
                                if ((event.key === "Enter" || event.key === " ") && !partyChoice.disabled && !member.downed) {
                                  event.preventDefault(); partyChoice.onSelect(member.id);
                                }
                              } : undefined}
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
                                    aria-label={member.shieldLabel ?? `盾牌 ${member.shield} 层`}
                                  >
                                    {member.shield}
                                  </span>
                                  <span
                                    className="abyssa-expedition-party-card__hearts"
                                    aria-label={`生命 ${member.hp} / ${member.maxHp}`}
                                  >
                                    {Array.from({ length: member.maxHp }, (_, slot) => (
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
                              {inspectHref && !saving && !isPresentationBusy() ? <a href={inspectHref(member.id)} aria-label={`查看${visual.name}档案`}><strong>{visual.nameplate}</strong></a> : <strong>{visual.nameplate}</strong>}
                            </div>
                            <AnimatedPartyLink active={linked} paused={isRolling || Boolean(attackFx) || Boolean(supportFx) || Boolean(enemyTurnFx)} />
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {dicePanel}
                </div>
        {sidebar}
      </ExpeditionBattleFrame>

      {overlays}
    </main>
  );
}
