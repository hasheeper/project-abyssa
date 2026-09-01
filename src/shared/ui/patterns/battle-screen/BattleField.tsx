import holyRoseIcon from "../../../../assets/svg/2-0-pentagram-rose.svg";
import holyCrossIcon from "../../../../assets/svg/6-0-split-cross.svg";
import { Nameplate } from "../../primitives/Nameplate";
import { Progress } from "../../primitives/Progress";
import type {
  BattleActionState,
  BattleAlly,
  BattleCustomProperties,
  BattleEnemy,
  BattleFloatingFeedback,
  BattlePlacement,
  BattleScene,
  BattleSpriteAdjustment,
  BattleSpritePose
} from "./types";

const poseCoordinates: Record<
  BattleSpritePose,
  { row: 0 | 1; column: 0 | 1 }
> = {
  idle: { row: 0, column: 0 },
  action: { row: 0, column: 1 },
  hurt: { row: 1, column: 0 },
  guard: { row: 1, column: 1 }
};

function getPlacementStyle(
  placement: BattlePlacement,
  adjustment?: BattleSpriteAdjustment
): BattleCustomProperties {
  return {
    left: `${placement.x}%`,
    top: `${placement.y}%`,
    zIndex: placement.zIndex,
    "--abyssa-battle-screen-x": `${placement.x}%`,
    "--abyssa-battle-screen-y": `${placement.y}%`,
    "--abyssa-battle-screen-anchor-x": `${placement.anchorX ?? 50}%`,
    "--abyssa-battle-screen-anchor-y": `${placement.anchorY ?? 100}%`,
    "--abyssa-battle-screen-scale":
      (placement.scale ?? 1) * (adjustment?.scale ?? 1),
    "--abyssa-battle-screen-pose-offset-x": `${adjustment?.offsetX ?? 0}%`,
    "--abyssa-battle-screen-pose-offset-y": `${adjustment?.offsetY ?? 0}%`
  };
}

function FloatingFeedback({
  feedback,
  unitId
}: {
  feedback?: BattleFloatingFeedback[];
  unitId: string;
}) {
  if (!feedback?.length) return null;

  return (
    <span className="abyssa-battle-screen__feedback-layer" aria-live="polite">
      {feedback.map((item, index) => {
        const style: BattleCustomProperties = {
          "--abyssa-battle-screen-feedback-x": `${item.offsetX ?? 0}%`,
          "--abyssa-battle-screen-feedback-y": `${item.offsetY ?? 0}%`
        };

        return (
          <span
            key={item.id ?? `${unitId}-feedback-${index}`}
            className="abyssa-battle-screen__feedback"
            data-tone={item.tone ?? "damage"}
            style={style}
          >
            {item.text}
          </span>
        );
      })}
    </span>
  );
}

function BattleAllySprite({
  ally,
  active,
  attack
}: {
  ally: BattleAlly;
  active: boolean;
  attack?: BattleActionState;
}) {
  const pose: BattleSpritePose = attack ? "action" : ally.pose ?? "idle";
  const coordinates = poseCoordinates[pose];
  const adjustment = ally.poseAdjustments?.[pose];

  const placementStyle = getPlacementStyle(ally.placement, adjustment);
  if (attack?.kind === "physical-single") {
    placementStyle["--abyssa-battle-actor-lunge-x"] = `${attack.lungeX}cqw`;
    placementStyle["--abyssa-battle-ally-drift-start-x"] = `${Math.sign(attack.lungeX) * .45}cqw`;
    placementStyle["--abyssa-battle-ally-drift-x"] = `${Math.sign(attack.lungeX) * 2.4}cqw`;
  } else if (attack?.kind === "holy-aoe") {
    placementStyle["--abyssa-battle-actor-lunge-x"] = `${attack.pushDirection * 3.2}cqw`;
    placementStyle["--abyssa-battle-ally-drift-start-x"] = `${attack.pushDirection * .18}cqw`;
    placementStyle["--abyssa-battle-ally-drift-x"] = `${attack.pushDirection * .9}cqw`;
  }

  return (
    <div
      className="abyssa-battle-screen__ally"
      data-unit-id={ally.id}
      data-active={active || undefined}
      data-disabled={ally.disabled || undefined}
      data-defeated={ally.hp <= 0 || undefined}
      data-sprite-flipped={ally.flipSprite || undefined}
      data-pose={pose}
      data-row={coordinates.row}
      data-column={coordinates.column}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={
        attack && (attack.phase === "impact" || attack.phase === "recover")
          ? true
          : undefined
      }
      style={placementStyle}
    >
      <span className="abyssa-battle-screen__ally-sprite-motion">
        <span className="abyssa-battle-screen__actor-aura" aria-hidden="true" />
        <span className="abyssa-battle-screen__ally-sprite-viewport">
          <img
            className="abyssa-battle-screen__ally-sprite"
            src={ally.spriteSheetUrl}
            alt={ally.spriteAlt ?? ally.name}
            data-pose={pose}
            data-row={coordinates.row}
            data-column={coordinates.column}
            draggable={false}
          />
        </span>
      </span>
      <FloatingFeedback feedback={ally.floatingFeedback} unitId={ally.id} />
    </div>
  );
}

function BattleEnemyTarget({
  enemy,
  selected,
  active,
  onSelect,
  attack,
  interactionDisabled
}: {
  enemy: BattleEnemy;
  selected: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  attack?: BattleActionState;
  interactionDisabled: boolean;
}) {
  const unavailable =
    interactionDisabled ||
    enemy.disabled ||
    enemy.targetable === false ||
    enemy.hp <= 0;
  const enemyStyle: BattleCustomProperties = {
    ...getPlacementStyle(enemy.placement),
    "--abyssa-battle-target-nameplate-scale": 1 / (enemy.placement.scale ?? 1)
  };
  if (attack?.kind === "physical-single") {
    enemyStyle["--abyssa-battle-enemy-knockback-x"] = `${Math.sign(attack.lungeX) * 4.5}cqw`;
    enemyStyle["--abyssa-battle-enemy-drift-x"] = `${Math.sign(attack.lungeX) * 5.6}cqw`;
  } else if (attack?.kind === "holy-aoe") {
    enemyStyle["--abyssa-battle-enemy-knockback-x"] = `${attack.pushDirection * 1.8}cqw`;
    enemyStyle["--abyssa-battle-enemy-drift-x"] = `${attack.pushDirection * 2.6}cqw`;
  }

  return (
    <button
      type="button"
      className="abyssa-battle-screen__enemy"
      data-unit-id={enemy.id}
      data-active={active || undefined}
      data-selected={selected || undefined}
      data-defeated={enemy.hp <= 0 || undefined}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={
        attack && (attack.phase === "impact" || attack.phase === "recover")
          ? true
          : undefined
      }
      data-interaction-locked={interactionDisabled || undefined}
      style={enemyStyle}
      disabled={unavailable}
      aria-label={`Target ${enemy.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(enemy.id)}
    >
      <span className="abyssa-battle-screen__enemy-health">
        <Progress
          className="abyssa-battle-screen__enemy-hp"
          value={enemy.hp}
          max={enemy.maxHp}
          size="sm"
          label={`${enemy.name} HP`}
        />
      </span>
      {selected && (
        <span className="abyssa-battle-screen__enemy-target-nameplate" aria-live="polite">
          <Nameplate name={enemy.name} secondaryName="TARGET" variant="dark" />
        </span>
      )}
      <span className="abyssa-battle-screen__target-ring" aria-hidden="true" />
      <span className="abyssa-battle-screen__enemy-sprite-motion">
        <img
          className="abyssa-battle-screen__enemy-sprite"
          src={enemy.spriteUrl}
          alt={enemy.spriteAlt ?? enemy.name}
          draggable={false}
        />
      </span>
      {attack?.kind === "physical-single" && (
        <>
          <span className="abyssa-battle-screen__attack-slash" data-slash="one" aria-hidden="true" />
          <span className="abyssa-battle-screen__attack-slash" data-slash="two" aria-hidden="true" />
        </>
      )}
      <FloatingFeedback feedback={enemy.floatingFeedback} unitId={enemy.id} />
    </button>
  );
}

export function BattleField({
  scene,
  allies,
  enemies,
  activeActorId,
  selectedTargetId,
  onSelectTarget,
  attack
}: {
  scene: BattleScene;
  allies: BattleAlly[];
  enemies: BattleEnemy[];
  activeActorId?: string;
  selectedTargetId?: string;
  onSelectTarget: (id: string) => void;
  attack?: BattleActionState;
}) {
  const impactActive = Boolean(
    attack && (attack.phase === "impact" || attack.phase === "recover")
  );
  const attackTarget = attack?.kind === "physical-single"
    ? enemies.find((enemy) => enemy.id === attack.targetId)
    : undefined;
  const holyTargets = attack?.kind === "holy-aoe"
    ? enemies.filter((enemy) => attack.targetIds.includes(enemy.id))
    : [];
  const fieldStyle: BattleCustomProperties | undefined = attack
    ? {
        "--abyssa-battle-camera-x": `${attack.cameraX}%`,
        "--abyssa-battle-camera-y": `${attack.cameraY}%`,
        "--abyssa-battle-camera-tilt": `${attack.cameraTilt}deg`,
        "--abyssa-battle-line-angle": `${attack.lineAngle}deg`,
        "--abyssa-battle-damage-drift-x": attack.kind === "physical-single"
          ? `${Math.sign(attack.lungeX) * 1.6}cqw`
          : "0cqw"
      }
    : undefined;

  return (
    <div
      className="abyssa-battle-screen__field"
      data-scene={scene.id}
      data-action-kind={attack?.kind}
      data-attack-phase={attack?.phase}
      data-impact-active={impactActive || undefined}
      aria-label={scene.label ?? "Battlefield"}
      style={fieldStyle}
    >
      <div className="abyssa-battle-screen__camera-world">
        <img
          className="abyssa-battle-screen__background"
          src={scene.backgroundUrl}
          alt={scene.backgroundAlt ?? ""}
          style={{ objectPosition: scene.backgroundPosition }}
          draggable={false}
        />
        <span className="abyssa-battle-screen__field-shade" aria-hidden="true" />

        <div className="abyssa-battle-screen__enemy-line">
          {enemies.map((enemy) => (
            <BattleEnemyTarget
              key={enemy.id}
              enemy={enemy}
              selected={enemy.id === selectedTargetId}
              active={enemy.id === activeActorId}
              onSelect={onSelectTarget}
              attack={
                attack && (
                  (attack.kind === "physical-single" && enemy.id === attack.targetId) ||
                  (attack.kind === "holy-aoe" && attack.targetIds.includes(enemy.id))
                )
                  ? attack
                  : undefined
              }
              interactionDisabled={Boolean(attack)}
            />
          ))}
        </div>

        <div className="abyssa-battle-screen__ally-line">
          {allies.map((ally) => (
            <BattleAllySprite
              key={ally.id}
              ally={ally}
              active={ally.id === activeActorId}
              attack={ally.id === attack?.actorId ? attack : undefined}
            />
          ))}
        </div>
      </div>
      <span className="abyssa-battle-screen__attack-vignette" aria-hidden="true" />
      <span className="abyssa-battle-screen__attack-flash" aria-hidden="true" />
      <span className="abyssa-battle-screen__attack-overlay" aria-hidden="true">
        {attack?.kind === "holy-aoe" && (
          <span className="abyssa-battle-screen__holy-spell-layer">
            <span
              className="abyssa-battle-screen__holy-sky-sigil"
              style={{ left: `${attack.spellX}%` }}
            >
              <span
                className="abyssa-battle-screen__holy-sigil-rose"
                style={{
                  WebkitMaskImage: `url(${holyRoseIcon})`,
                  maskImage: `url(${holyRoseIcon})`
                }}
              />
              <span
                className="abyssa-battle-screen__holy-sigil-cross"
                style={{
                  WebkitMaskImage: `url(${holyCrossIcon})`,
                  maskImage: `url(${holyCrossIcon})`
                }}
              />
            </span>
            {holyTargets.map((enemy) => {
              const spellStyle: BattleCustomProperties = {
                "--abyssa-battle-holy-target-x": `${enemy.placement.x}%`,
                "--abyssa-battle-holy-target-y": `${enemy.placement.y}%`
              };
              return (
                <span
                  key={enemy.id}
                  className="abyssa-battle-screen__holy-strike"
                  data-target-id={enemy.id}
                  style={spellStyle}
                >
                  <span className="abyssa-battle-screen__holy-ray" />
                  <span className="abyssa-battle-screen__holy-impact-sigil" />
                  <span className="abyssa-battle-screen__holy-impact-bloom" />
                </span>
              );
            })}
          </span>
        )}
        {attackTarget && (
          <span
            className="abyssa-battle-screen__field-attack-damage"
            style={{
              left: `${attackTarget.placement.x}%`,
              top: `${Math.max(10, attackTarget.placement.y - 42)}%`
            }}
          >
            {attack?.kind === "physical-single" ? attack.damage : null}
          </span>
        )}
        {attack?.kind === "holy-aoe" && holyTargets.map((enemy) => (
          <span
            key={enemy.id}
            className="abyssa-battle-screen__field-attack-damage abyssa-battle-screen__field-holy-damage"
            style={{
              left: `${enemy.placement.x}%`,
              top: `${Math.max(10, enemy.placement.y - 42)}%`
            }}
          >
            {attack.damageByTarget[enemy.id]}
          </span>
        ))}
      </span>
      {!selectedTargetId && <span className="abyssa-battle-screen__no-target">NO TARGET</span>}
    </div>
  );
}
