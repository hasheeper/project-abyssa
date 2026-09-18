import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTutorialAnchors } from "../../../shared/tutorial";
import { useSceneSequenceBusy } from "../../../shared/presentation/adv/SceneSequence";
import { getNextBattleUiSkin } from "../battleUiSkins";
import type { ExpeditionBattleScreenProps } from "../ExpeditionBattleScreen";
import { PARTY_VISUALS } from "./expedition-visuals";
import { useEnemyStageLayout } from "./useEnemyStageLayout";
import { useBattleMotionPolicy } from "./useBattleMotionPolicy";
import { ExpeditionEnemyStage } from "./ExpeditionEnemyStage";
import { AnimatedPartyLink } from "./ExpeditionBattleChrome";
import { ExpeditionBattleFrame } from "./ExpeditionBattleFrame";
import { JOURNEY_MOTION_MS, type JourneyMotion } from "./journey-motion";
import type { BattleSurfaceMember, BattleSurfaceEnemy, BattleEnemyFx } from "./battle-surface-model";
import type { PlayerAttackFx, PlayerSupportFx } from "./useExpeditionBattlePresentation";

export type BattleSurfaceProps = ExpeditionBattleScreenProps & {
  inert?: boolean;
  entrance?: boolean;
  formationKey?: string;
  label: string; party: BattleSurfaceMember[]; presentedEnemies: BattleSurfaceEnemy[];
  phase: string; layerClearPending: boolean; isRolling: boolean; interactive: boolean;
  heldActor: string | null; attackFx: PlayerAttackFx | null; supportFx: PlayerSupportFx | null; enemyTurnFx: BattleEnemyFx | null;
  isPresentationBusy: () => boolean;
  handleMemberCardClick: (id: string) => void; handleEnemyClick: (id: string) => void; handleIntentClick: (id: string) => void;
  dicePanel: ReactNode; sidebar: ReactNode; overlays: ReactNode; sceneStyle?: CSSProperties; title?: string; location?: string;
  journey?: { content: ReactNode; key: string; label: string };
  journeyMotion?: JourneyMotion | null;
  roomLoading?: ReactNode;
  partyChoice?: { selectedId: string; disabled: boolean; canSelect?: (id: string) => boolean; onSelect: (id: string) => void };
  canSelectMember?: (id: string) => boolean;
};
/** The approved battle markup, shared by content versions. No game rules live here. */
export function ExpeditionBattleSurface({
  inspectHref, saving = false, uiSkin, defaultUiSkin = "timber", onUiSkinChange,
  label, party, presentedEnemies, phase, layerClearPending, isRolling, interactive,
  heldActor, attackFx, supportFx, enemyTurnFx, isPresentationBusy,
  handleMemberCardClick, handleEnemyClick, handleIntentClick, dicePanel, sidebar, overlays, sceneStyle, title, location,
  journey, journeyMotion, roomLoading, partyChoice, canSelectMember,
  inert, entrance, formationKey = "battle",
}: BattleSurfaceProps) {
  const anchor=useTutorialAnchors();
  const sequenceBusy = useSceneSequenceBusy();
  const enemyLayout = useEnemyStageLayout(presentedEnemies,formationKey,party.map(member=>member.id),!sequenceBusy);
  const {reflowing}=enemyLayout;
  const motionPolicy=useBattleMotionPolicy({
    blocked:Boolean(inert)||sequenceBusy||journeyMotion==="loading",
    foregroundBusy:isRolling||Boolean(attackFx)||Boolean(supportFx)||Boolean(enemyTurnFx)||reflowing||Boolean(journeyMotion)||isPresentationBusy(),
  });
  const pointerInput = useRef(false);
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
      inert={inert}
      style={{
        "--party-size": party.length,
        "--journey-walk-ms": `${JOURNEY_MOTION_MS.walking}ms`,
        "--journey-arrive-ms": `${JOURNEY_MOTION_MS.arriving}ms`,
        "--journey-encounter-ms": `${JOURNEY_MOTION_MS.encounter}ms`,
        "--journey-flash-ms": `${JOURNEY_MOTION_MS.flash}ms`,
        "--journey-reveal-ms": `${JOURNEY_MOTION_MS.revealing}ms`,
      } as CSSProperties}
      data-ui-skin={activeUiSkin}
      data-enemy-ui="separated"
      data-enemy-reflowing={reflowing||undefined}
      data-ambient-paused={motionPolicy.ambientPaused||undefined}
      data-links-paused={motionPolicy.linksPaused||undefined}
      onKeyDownCapture={() => { pointerInput.current = false; }}
      data-manor-entry={entrance || undefined}
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
      <ExpeditionBattleFrame title={title} location={location} skin={activeUiSkin} onCycleSkin={cycleUiSkin}>
        <div className="abyssa-expedition-regions__battlefield">
                  {/* ==================== 敌方区域 ==================== */}
                  <ExpeditionEnemyStage
                    motionPolicy={motionPolicy}
                    layout={enemyLayout} sequenceBusy={sequenceBusy} activeUiSkin={activeUiSkin} pointerInput={pointerInput}
                    party={party} presentedEnemies={presentedEnemies} entrance={entrance} inert={inert}
                    isPresentationBusy={isPresentationBusy} attackFx={attackFx} enemyTurnFx={enemyTurnFx} supportFx={supportFx} isRolling={isRolling}
                    interactive={interactive} handleEnemyClick={handleEnemyClick} handleIntentClick={handleIntentClick}
                    sceneStyle={sceneStyle} journey={journey} journeyMotion={journeyMotion} roomLoading={roomLoading}
                  />

                  {/* ==================== 我方区域 ==================== */}
                  <section className="abyssa-expedition-region abyssa-expedition-party" aria-label="我方区域">
                    <div className="abyssa-expedition-party__cards">
                      {party.map((member, memberIndex) => {
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
                        const selectable = partyChoice
                          ? !partyChoice.disabled && !member.downed && (partyChoice.canSelect?.(member.id) ?? true)
                          : interactive && !member.downed && (canSelectMember?.(member.id) ?? (ready || Boolean(heldActor)));
                        const selectMember = () => {
                          if (!selectable) return;
                          if (partyChoice) partyChoice.onSelect(member.id);
                          else handleMemberCardClick(member.id);
                        };

                        return (
                          <div
                            className="abyssa-expedition-party-column"
                            style={{"--manor-order": memberIndex} as CSSProperties}
                            data-active={linked || undefined}
                            data-held={held || undefined}
                            data-attacking={attacking || undefined}
                            data-supporting={supporting || undefined}
                            key={member.id}
                          >
                            <article
                              ref={anchor(`battle.member:${member.id}`)}
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
                              data-event-selectable={partyChoice && selectable || undefined}
                              data-event-selected={partyChoice?.selectedId === member.id || undefined}
                              role="button"
                              tabIndex={selectable ? 0 : -1}
                              aria-pressed={partyChoice ? partyChoice.selectedId === member.id : undefined}
                              aria-disabled={!selectable}
                              data-attacking={attacking || undefined}
                              data-supporting={supporting || undefined}
                              data-support-kind={memberSupportFx?.kind}
                              data-support-phase={memberSupportFx?.phase}
                              data-ready={(ready && !held) || undefined}
                              data-clickable={selectable || undefined}
                              aria-label={`${visual.name}：生命 ${member.hp} / ${member.maxHp}${
                                member.downed
                                  ? `，力竭倒下，本层无法行动，下一层以 ${member.returnHp} 点生命重整`
                                  : ready
                                    ? "，待指挥"
                                    : ""
                              }`}
                              onClick={selectMember}
                              onKeyDown={event => {
                                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                                  event.preventDefault(); selectMember();
                                }
                              }}
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
                                    ref={anchor(`battle.health:${member.id}`)}
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
                            <AnimatedPartyLink active={linked} paused={motionPolicy.linksPaused} />
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
