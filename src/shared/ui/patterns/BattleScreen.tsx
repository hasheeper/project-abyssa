import { useCallback } from "react";
import { useControllableState } from "../../lib/useControllableState";
import { cx } from "../../lib/cx";
import { RpgFrame } from "../primitives/RpgFrame";
import { RpgHeader } from "../primitives/RpgHeader";
import { BattleCommandMenu } from "./battle-screen/BattleCommandMenu";
import { BattleField } from "./battle-screen/BattleField";
import { BattlePartyStatus } from "./battle-screen/BattlePartyStatus";
import { BattleTurnOrder } from "./battle-screen/BattleTurnOrder";
import { useBattleActionPlayback } from "./battle-screen/useBattleActionPlayback";
import type { BattleCommandId, BattleScreenProps } from "./battle-screen/types";
import { FrameEdgeWeave } from "./internal/FrameEdgeWeave";

export type {
  BattleActionKind,
  BattleAlly,
  BattleAttackEvent,
  BattleAttackMotionMode,
  BattleAttackPhase,
  BattleCommandId,
  BattleEnemy,
  BattleFloatingFeedback,
  BattleHolyAttackEvent,
  BattlePlacement,
  BattleScene,
  BattleScreenProps,
  BattleSpriteAdjustment,
  BattleSpritePose,
  BattleTurnEntry
} from "./battle-screen/types";

export function BattleScreen({
  scene,
  allies,
  enemies,
  turnOrder,
  activeActorId,
  selectedCommandId,
  defaultSelectedCommandId = "attack",
  onSelectedCommandIdChange,
  selectedTargetId,
  defaultSelectedTargetId,
  onSelectedTargetIdChange,
  attackDamage = 310,
  onAttack,
  holyAttackDamage = 240,
  onHolyAttack,
  attackMotionMode = "system",
  commandsDisabled = false,
  title = "BATTLE",
  subtitle = "THE GREAT BALANCE",
  className,
  ...props
}: BattleScreenProps) {
  const firstAvailableEnemy = enemies.find(
    (enemy) =>
      enemy.hp > 0 && enemy.targetable !== false && !enemy.disabled
  );
  const validDefaultTarget = enemies.find(
    (enemy) =>
      enemy.id === defaultSelectedTargetId &&
      enemy.hp > 0 &&
      enemy.targetable !== false &&
      !enemy.disabled
  );
  const [currentCommandId, setCurrentCommandId] =
    useControllableState<BattleCommandId>({
      value: selectedCommandId,
      defaultValue: defaultSelectedCommandId,
      onChange: onSelectedCommandIdChange
    });
  const [requestedTargetId, setRequestedTargetId] = useControllableState<string>({
    value: selectedTargetId,
    defaultValue: validDefaultTarget?.id ?? firstAvailableEnemy?.id ?? "",
    onChange: onSelectedTargetIdChange
  });
  const requestedTarget = enemies.find(
    (enemy) =>
      enemy.id === requestedTargetId &&
      enemy.hp > 0 &&
      enemy.targetable !== false &&
      !enemy.disabled
  );
  const currentTargetId = requestedTarget?.id ?? firstAvailableEnemy?.id;
  const activeAlly = allies.find(
    (ally) => ally.id === activeActorId && ally.hp > 0 && !ally.disabled
  );
  const attackActor =
    activeAlly ?? allies.find((ally) => ally.hp > 0 && !ally.disabled);
  const commandMenuDisabled =
    commandsDisabled ||
    allies.length === 0 ||
    (activeActorId !== undefined && !activeAlly);

  const { attackState, runAttack, runHolyAttack } = useBattleActionPlayback({
    attackActor,
    currentTargetId,
    enemies,
    commandMenuDisabled,
    attackDamage,
    onAttack,
    holyAttackDamage,
    onHolyAttack
  });

  const handleCommandSelect = useCallback((id: BattleCommandId) => {
    const wasSelected = currentCommandId === id;
    setCurrentCommandId(id);
    if (id === "attack") void runAttack();
    if (id === "skills" && wasSelected) void runHolyAttack();
  }, [currentCommandId, runAttack, runHolyAttack, setCurrentCommandId]);

  return (
    <section
      className={cx("abyssa-battle-screen", className)}
      data-tone={scene.tone}
      data-scene-tone={scene.tone}
      data-commands-disabled={commandMenuDisabled || undefined}
      data-action-kind={attackState?.kind}
      data-attack-phase={attackState?.phase}
      data-attack-motion={attackMotionMode}
      data-cinematic={attackState ? true : undefined}
      aria-busy={Boolean(attackState)}
      {...props}
    >
      <div className="abyssa-battle-screen__header-row">
        <span
          className="abyssa-battle-screen__header-wing"
          data-side="left"
          aria-hidden="true"
        />
        <RpgHeader
          className="abyssa-battle-screen__header"
          label={title}
          description={subtitle}
          variant="dark"
        />
        <span
          className="abyssa-battle-screen__header-wing"
          data-side="right"
          aria-hidden="true"
        />
      </div>

      <RpgFrame
        className="abyssa-battle-screen__shell"
        padding="none"
        variant="dark"
        ornamented={false}
      >
        <FrameEdgeWeave namespace="abyssa-battle-screen" />
        <BattleTurnOrder entries={turnOrder} activeActorId={activeActorId} />
        <BattleField
          scene={scene}
          allies={allies}
          enemies={enemies}
          activeActorId={activeActorId}
          selectedTargetId={currentTargetId}
          onSelectTarget={setRequestedTargetId}
          attack={attackState}
        />
        <div className="abyssa-battle-screen__hud">
          <BattlePartyStatus allies={allies} activeActorId={activeActorId} />
          <BattleCommandMenu
            selectedCommandId={currentCommandId}
            disabled={commandMenuDisabled || Boolean(attackState)}
            onSelect={handleCommandSelect}
          />
        </div>
      </RpgFrame>
    </section>
  );
}
