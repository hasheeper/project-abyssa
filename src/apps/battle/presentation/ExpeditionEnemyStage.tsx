import { useCallback, useState, type RefObject } from "react";
import { useTutorialAnchors } from "../../../shared/tutorial";
import { FRENZY_ATTACK_BONUS } from "../view";
import { ExpeditionGlyph } from "../ExpeditionGlyph";
import { resolveBattleUiSkin, type BattleUiSkin } from "../battleUiSkins";
import { INTENT_GLYPH } from "./expedition-visuals";
import { enemyHealthLayers, intentLinkPath } from "./enemy-stage-model";
import { EnemyHealth } from "./EnemyHealth";
import { EnemyMist } from "./EnemyMist";
import type { BattleSurfaceProps } from "./ExpeditionBattleSurface";
import type { useEnemyStageLayout } from "./useEnemyStageLayout";
import type { BattleMotionPolicy } from "./useBattleMotionPolicy";

type Props = Pick<BattleSurfaceProps, "party" | "presentedEnemies" | "entrance" | "inert" | "isPresentationBusy" | "attackFx" | "enemyTurnFx" | "supportFx" | "isRolling" | "interactive" | "handleEnemyClick" | "handleIntentClick" | "sceneStyle" | "journey" | "journeyMotion" | "roomLoading"> & {
  layout: ReturnType<typeof useEnemyStageLayout>;
  sequenceBusy: boolean;
  activeUiSkin: BattleUiSkin;
  pointerInput: RefObject<boolean>;
  motionPolicy: BattleMotionPolicy;
};

/** Hover/focus is local to the enemy region, not the frame, party or dice. */
export function ExpeditionEnemyStage({
  layout: {stageRef,seats,lines,reflowing}, sequenceBusy, activeUiSkin, pointerInput, motionPolicy,
  party, presentedEnemies, entrance, inert, isPresentationBusy, attackFx, enemyTurnFx, supportFx, isRolling,
  interactive, handleEnemyClick, handleIntentClick, sceneStyle, journey, journeyMotion, roomLoading,
}: Props) {
  const anchor=useTutorialAnchors();
  const attachStage=useCallback((node:HTMLElement|null)=>{
    stageRef.current=node;
    anchor("battle.enemies")(node);
  },[stageRef,anchor]);
  const [pointed,setPointed] = useState<string|null>(null);
  const [focused,setFocused] = useState<string|null>(null);
  const previewCandidate=pointed ?? focused;
  const previewId=!inert&&!sequenceBusy&&!reflowing&&!isPresentationBusy()&&!attackFx&&!enemyTurnFx&&!supportFx&&!isRolling&&presentedEnemies.some(enemy=>enemy.id===previewCandidate&&!enemy.defeated) ? previewCandidate : null;
  // Scene-owned seats stay settled at idle. Capture only the initial formation;
  // later room enemies and summons still use their own mount entrance.
  const [entrySeats] = useState(() => new Set(entrance ? presentedEnemies.map(enemy => enemy.id) : []));
  return (
    <section ref={attachStage} data-enemy-previewing={previewId || undefined} className="abyssa-expedition-region abyssa-expedition-enemies" aria-label={journey?.label ?? "敌方单位"} style={sceneStyle}>
      {sceneStyle && <div className="abyssa-expedition-scene-clip" aria-hidden="true"><div className="abyssa-expedition-scene" style={sceneStyle}/></div>}
      <span className="abyssa-expedition-enemies__haze" aria-hidden="true" />
      {resolveBattleUiSkin(activeUiSkin).enemyAtmosphere === "mist" && <EnemyMist paused={motionPolicy.ambientPaused} foregroundBusy={motionPolicy.fogThrottled} />}
      {journey && <div className="abyssa-expedition-journey-content" key={journey.key}>{journey.content}</div>}
      {(journeyMotion === "flash" || journeyMotion === "revealing") && <span className="abyssa-expedition-encounter-flash" aria-hidden="true" />}
      {roomLoading}
      <div
        className="abyssa-expedition-enemies__formation"
        data-dense={seats.length>4||undefined}
      >
        {presentedEnemies.map((enemy, enemyIndex) => {
          const intent = enemy.intent;
          const blocked = enemy.blocked;
          const health = enemyHealthLayers(enemy.hp,enemy.maxHp);
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
              data-entry-seated={entrySeats.has(enemy.id) || undefined}
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
              ref={anchor(`battle.enemy:${enemy.id}`)}
              style={{ animationDelay: `${enemyIndex * 70}ms` }}
              key={enemy.id}
              role="button"
              tabIndex={targetable || intentBlockable ? 0 : -1}
              aria-disabled={!targetable && !intentBlockable}
              aria-label={`${enemy.boss ? "首领，" : ""}${enemy.name}，生命 ${enemy.hp} / ${enemy.maxHp}，攻击力 ${enemy.attack}`}
              data-boss={enemy.boss || undefined}
              data-previewed={previewId===enemy.id || undefined}
              onPointerEnter={event=>{if(event.pointerType!=="touch"){setFocused(null);setPointed(enemy.id);}}}
              onPointerLeave={()=>setPointed(current=>current===enemy.id?null:current)}
              onPointerDown={event=>{pointerInput.current=true;setFocused(null);if(event.pointerType==="touch")setPointed(enemy.id);}}
              onPointerUp={event=>{if(event.pointerType==="touch")setPointed(null);}}
              onPointerCancel={()=>{setPointed(null);setFocused(null);}}
              onFocus={event=>{if(!pointerInput.current&&event.target.matches(":focus-visible")){setPointed(null);setFocused(enemy.id);}pointerInput.current=false;}}
              onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setFocused(null);}}
              onClick={() => {if (targetable || intentBlockable) handleEnemyClick(enemy.id);}}
              onKeyDown={event => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  if (targetable || intentBlockable) handleEnemyClick(enemy.id);
                }
              }}
            >
              <div className="abyssa-enemy-intent-zone">
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
                  <span className="abyssa-enemy-sr-only">狂暴预警，</span>
                  <b>{frenzyWarning > 0 ? `${frenzyWarning} 回合` : "即将爆发"}</b>
                  <span className="abyssa-enemy-sr-only">，ATK {enemy.attack} → {enemy.attack + FRENZY_ATTACK_BONUS}</span>
                </span>
              ) : frenzyActive ? (
                <span
                  className="abyssa-expedition-enemy__frenzy-status"
                  data-active="true"
                  role="status"
                  aria-label={`${enemy.name}正在狂暴：攻击 ${enemy.attack}，不可解除，持续至死亡`}
                >
                  <b>狂暴</b>
                  <span className="abyssa-enemy-sr-only">持续至死亡，ATK {enemy.attack}，不可解除</span>
                </span>
              ) : null}
                {intent && (
                  <button
                    ref={anchor(`battle.intent:${enemy.id}`)}
                    type="button"
                    className="abyssa-expedition-intent"
                    data-kind={intent.type}
                    data-blockable={intentBlockable || undefined}
                    data-threat={enemy.threat ?? undefined}
                    title={intent.description}
                    aria-label={intent.description}
                    aria-disabled={!intentBlockable}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (intentBlockable) handleIntentClick(enemy.id);
                    }}
                  >
                    <ExpeditionGlyph name={intent.type==="attack"?"enemy-attack":intent.type==="charge"?"enemy-charge":INTENT_GLYPH[intent.type] ?? "art"} />
                    <b>
                      {intent.type === "attack"
                        ? Math.max(0, (intent.value ?? 0) - blocked)
                        : intent.title}
                    </b>
                  </button>
                )}
              </div>
              <header>
                <span className="abyssa-enemy-focus-rule" aria-hidden="true"/>
                {enemy.boss && <span className="abyssa-enemy-boss" role="img" aria-label="首领（Boss）"><ExpeditionGlyph name="boss"/></span>}
                <strong title={enemy.name}>{enemy.name}{health.showLayerNumber&&<small className="abyssa-enemy-health-layer" aria-label={`第 ${health.layer} 层`}>{health.number}</small>}</strong>
                <span ref={anchor(`battle.enemy-health:${enemy.id}`)} className="abyssa-expedition-enemy__health" aria-label={`生命 ${enemy.hp} / ${enemy.maxHp}`}>
                  <EnemyHealth hp={enemy.hp} maxHp={enemy.maxHp}/>
                </span>
              </header>
              <img src={enemy.artUrl} style={enemy.artStyle} alt="" />
              <span className="abyssa-enemy-hit-area" aria-hidden="true"/>
              <span className="abyssa-enemy-focus-frame" aria-hidden="true"><i/><i/><i/><i/></span>
              <span className="abyssa-enemy-line-anchor" aria-hidden="true"/>
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
        viewBox={`0 0 ${lines.width || 1} ${lines.height || 1}`}
        style={{height:lines.height || 0}}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {presentedEnemies.map(enemy => {
          if (!enemy.intent?.targetId || enemy.defeated || !party.some(member=>member.id===enemy.intent?.targetId)) return null;
          const link=lines.links.find(link=>link.id===enemy.id);
          const path=link?intentLinkPath(link):undefined;
          return (
            <g
              data-enemy-id={enemy.id}
              data-kind={enemy.intent.type}
              data-target-id={enemy.intent.targetId}
              data-threat={enemy.threat ?? undefined}
              data-previewed={previewId===enemy.id || undefined}
              data-resolving={enemyTurnFx?.enemyId === enemy.id || undefined}
              visibility={link?undefined:"hidden"}
              key={`${enemy.id}-line`}
            >
              <path className="abyssa-expedition-intent-line__shadow" d={path} />
              <path className="abyssa-expedition-intent-line__body" d={path} />
              {link&&<circle className="abyssa-expedition-intent-line__socket" cx={link.fromX} cy={link.fromY} r="2.5" />}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
