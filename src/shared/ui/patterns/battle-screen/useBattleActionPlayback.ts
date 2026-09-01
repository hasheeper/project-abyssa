import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BattleActionState,
  BattleAlly,
  BattleAttackEvent,
  BattleAttackState,
  BattleEnemy,
  BattleHolyAttackEvent,
  BattleHolyAttackState
} from "./types";

interface UseBattleActionPlaybackOptions {
  attackActor?: BattleAlly;
  currentTargetId?: string;
  enemies: BattleEnemy[];
  commandMenuDisabled: boolean;
  attackDamage: number;
  onAttack?: (event: BattleAttackEvent) => void;
  holyAttackDamage: number | Readonly<Record<string, number>>;
  onHolyAttack?: (event: BattleHolyAttackEvent) => void;
}

export function useBattleActionPlayback({
  attackActor,
  currentTargetId,
  enemies,
  commandMenuDisabled,
  attackDamage,
  onAttack,
  holyAttackDamage,
  onHolyAttack
}: UseBattleActionPlaybackOptions) {
  const attackRunRef = useRef(0);
  const attackBusyRef = useRef(false);
  const attackTimersRef = useRef<number[]>([]);
  const [attackState, setAttackState] = useState<BattleActionState>();
  const waitForAttackFrame = useCallback((duration: number, runId: number) => {
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        attackTimersRef.current = attackTimersRef.current.filter(
          (activeTimer) => activeTimer !== timer
        );
        resolve(attackRunRef.current === runId);
      }, duration);
      attackTimersRef.current.push(timer);
    });
  }, []);

  useEffect(() => {
    return () => {
      attackRunRef.current += 1;
      attackBusyRef.current = false;
      attackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      attackTimersRef.current = [];
    };
  }, []);

  const runAttack = useCallback(async () => {
    if (
      attackBusyRef.current ||
      commandMenuDisabled ||
      !attackActor ||
      !currentTargetId
    ) {
      return;
    }

    const attackTarget = enemies.find((enemy) => enemy.id === currentTargetId);
    if (!attackTarget) return;

    const direction = Math.sign(
      attackTarget.placement.x - attackActor.placement.x
    ) || 1;
    const deltaX = attackTarget.placement.x - attackActor.placement.x;
    const deltaY = attackTarget.placement.y - attackActor.placement.y;
    const runId = ++attackRunRef.current;
    const baseAttack: Omit<BattleAttackState, "phase"> = {
      kind: "physical-single",
      actorId: attackActor.id,
      targetId: currentTargetId,
      damage: attackDamage,
      lungeX: direction * 11.5,
      cameraX: Math.min(
        88,
        Math.max(12, (attackActor.placement.x + attackTarget.placement.x) / 2)
      ),
      cameraY: Math.min(
        82,
        Math.max(18, (attackActor.placement.y + attackTarget.placement.y) / 2 - 10)
      ),
      cameraTilt: direction * -1.6,
      lineAngle: Math.atan2(deltaY * .61, deltaX) * 180 / Math.PI
    };

    attackBusyRef.current = true;
    setAttackState({ ...baseAttack, phase: "anticipate" });
    if (!(await waitForAttackFrame(100, runId))) return;
    setAttackState({ ...baseAttack, phase: "hitstop" });
    if (!(await waitForAttackFrame(70, runId))) return;
    setAttackState({ ...baseAttack, phase: "impact" });
    onAttack?.({ actorId: attackActor.id, targetId: currentTargetId, damage: attackDamage });
    if (!(await waitForAttackFrame(280, runId))) return;
    setAttackState({ ...baseAttack, phase: "recover" });
    if (!(await waitForAttackFrame(420, runId))) return;
    setAttackState(undefined);
    attackBusyRef.current = false;
  }, [
    attackActor,
    attackDamage,
    commandMenuDisabled,
    currentTargetId,
    enemies,
    onAttack,
    waitForAttackFrame
  ]);

  const runHolyAttack = useCallback(async () => {
    if (attackBusyRef.current || commandMenuDisabled || !attackActor) return;

    const targets = enemies.filter((enemy) => enemy.hp > 0 && !enemy.disabled);
    if (!targets.length) return;

    const spellX = targets.reduce(
      (total, enemy) => total + enemy.placement.x,
      0
    ) / targets.length;
    const targetY = targets.reduce(
      (total, enemy) => total + enemy.placement.y,
      0
    ) / targets.length;
    const damageByTarget = Object.fromEntries(
      targets.map((enemy) => [
        enemy.id,
        typeof holyAttackDamage === "number"
          ? holyAttackDamage
          : holyAttackDamage[enemy.id] ?? 240
      ])
    );
    const targetIds = targets.map((enemy) => enemy.id);
    const runId = ++attackRunRef.current;
    const baseAttack: Omit<BattleHolyAttackState, "phase"> = {
      kind: "holy-aoe",
      actorId: attackActor.id,
      targetIds,
      damageByTarget,
      spellX,
      pushDirection: Math.sign(spellX - attackActor.placement.x) || 1,
      cameraX: Math.min(
        84,
        Math.max(16, (attackActor.placement.x + spellX) / 2)
      ),
      cameraY: Math.min(70, Math.max(24, targetY - 20)),
      cameraTilt: .65,
      lineAngle: 0
    };

    attackBusyRef.current = true;
    setAttackState({ ...baseAttack, phase: "anticipate" });
    if (!(await waitForAttackFrame(220, runId))) return;
    setAttackState({ ...baseAttack, phase: "hitstop" });
    if (!(await waitForAttackFrame(180, runId))) return;
    setAttackState({ ...baseAttack, phase: "impact" });
    onHolyAttack?.({ actorId: attackActor.id, targetIds, damageByTarget });
    if (!(await waitForAttackFrame(330, runId))) return;
    setAttackState({ ...baseAttack, phase: "recover" });
    if (!(await waitForAttackFrame(430, runId))) return;
    setAttackState(undefined);
    attackBusyRef.current = false;
  }, [
    attackActor,
    commandMenuDisabled,
    enemies,
    holyAttackDamage,
    onHolyAttack,
    waitForAttackFrame
  ]);

  return { attackState, runAttack, runHolyAttack };
}
