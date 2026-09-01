import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { randomRollDuration } from "../../../shared/presentation/roll/timing";
import {
  getExpeditionDieRotation,
  nextExpeditionDieRotation,
  type ExpeditionDieRotation
} from "../ExpeditionDie3D";
import {
  PARTY_ORDER,
  getBattlePhase,
  getExpeditionStatus,
  getRoundOutcome,
  isEnemyDefeated,
  type CharacterId,
  type EnemyIntent,
  type EnemyTurnEvent,
  type ExpeditionState
} from "../engine";
import {
  getEnemyTurnCue,
  type PlayerAttackCue,
  type PlayerSupportCue
} from "../controller/presentation-events";
import {
  useExpeditionBattleController
} from "../controller/useExpeditionBattleController";
import { usePresentationQueue } from "../controller/usePresentationQueue";

export type ExpeditionDieVisual = {
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

export type PlayerAttackFx = PlayerAttackCue & {
  runId: number;
  phase: PlayerAttackPhase;
};

type PlayerSupportPhase = "anticipate" | "release" | "impact" | "settle";

export type PlayerSupportFx = PlayerSupportCue & {
  runId: number;
  phase: PlayerSupportPhase;
};

type EnemyTurnPhase = "anticipate" | "lunge" | "hitstop" | "impact" | "recover";

export type EnemyTurnFx = EnemyTurnEvent & {
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

/* 每只怪物完成整段演出后，下一只才进入 anticipate。 */
const ENEMY_TURN_TIMING = {
  anticipate: 120,
  lunge: 100,
  hitstop: 60,
  impact: 320,
  recover: 220
} as const;

/* 最后一只怪物倒下后，留足时间播放斩杀退场，再打开层结算。 */
const LAYER_CLEAR_DELAY = 1200;

function effectFrameDuration(duration: number): number {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return duration;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? Math.min(duration, 60)
    : duration;
}

function createInitialVisuals(): Record<CharacterId, ExpeditionDieVisual> {
  return Object.fromEntries(
    PARTY_ORDER.map((id) => [
      id,
      { rotation: { x: -18, y: 28 }, rolling: false, rollDuration: 0.9 }
    ])
  ) as Record<CharacterId, ExpeditionDieVisual>;
}

type ExpeditionBattleController = ReturnType<typeof useExpeditionBattleController>;

/**
 * Owns battle-only animation state and timing. Domain transitions still come
 * from the controller; this hook only decides when their visible state commits.
 */
export function useExpeditionBattlePresentation(
  controller: ExpeditionBattleController
) {
  const presentation = usePresentationQueue();
  const engine = controller.state;
  const commitTransition = controller.commitTransition;
  const setHeldActor = controller.holdActor;
  const getEngine = controller.getState;
  const transition = controller.transition;
  const pendingLayerClearId = controller.pendingLayerClearId;
  const acknowledgeLayerClear = controller.acknowledgeLayerClear;
  const [visuals, setVisuals] = useState<Record<CharacterId, ExpeditionDieVisual>>(
    createInitialVisuals
  );
  const [attackFx, setAttackFx] = useState<PlayerAttackFx | null>(null);
  const [supportFx, setSupportFx] = useState<PlayerSupportFx | null>(null);
  const [enemyTurnFx, setEnemyTurnFx] = useState<EnemyTurnFx | null>(null);
  const rollTimerRef = useRef<number | null>(null);
  const layerClearTimerRef = useRef<number | null>(null);
  const enemyNodesRef = useRef(new Map<string, HTMLElement>());
  const previousEnemyRectsRef = useRef(new Map<string, DOMRect>());

  const phase = getBattlePhase(engine);
  const status = getExpeditionStatus(engine);
  const layerClearPending = pendingLayerClearId !== null;
  const isRolling = PARTY_ORDER.some((id) => visuals[id].rolling);
  const interactive =
    phase === "act" &&
    status === "active" &&
    !layerClearPending &&
    !isRolling &&
    !presentation.busy &&
    attackFx === null &&
    supportFx === null &&
    enemyTurnFx === null;
  const canInitialRoll =
    phase === "roll" &&
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

  const animateDice = (after: ExpeditionState) => {
    /* Build the complete plan synchronously; StrictMode may replay state updaters. */
    const plan: { ownerId: CharacterId; value: number; duration: number }[] = [];
    const tossed = new Set(after.lastTossed);

    for (const die of after.dice) {
      if (die.sealed || die.faceIndex === null || !tossed.has(die.ownerId)) continue;
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
          rotation: nextExpeditionDieRotation(
            current[entry.ownerId].rotation,
            entry.value
          ),
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

  const setAttackPhase = (runId: number, nextPhase: PlayerAttackPhase) => {
    setAttackFx((current) =>
      current?.runId === runId ? { ...current, phase: nextPhase } : current
    );
  };

  const playPlayerAttack = async (
    result: Parameters<typeof commitTransition>[0],
    cue: PlayerAttackCue
  ) => {
    const runId = presentation.begin();
    if (runId === null) return;
    setAttackFx({ ...cue, runId, phase: "anticipate" });

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.anticipate), runId))) return;
    setAttackPhase(runId, "hitstop");

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.hitstop), runId))) return;
    commitTransition(result);
    setHeldActor(null);
    setAttackPhase(runId, "impact");

    if (!(await presentation.wait(effectFrameDuration(ATTACK_TIMING.impact), runId))) return;
    setAttackPhase(runId, cue.lethal ? "defeat" : "recover");

    if (
      !(await presentation.wait(
        effectFrameDuration(cue.lethal ? ATTACK_TIMING.defeat : ATTACK_TIMING.recover),
        runId
      ))
    ) {
      return;
    }

    setAttackFx((current) => (current?.runId === runId ? null : current));
    presentation.complete(runId);
  };

  const setSupportPhase = (runId: number, nextPhase: PlayerSupportPhase) => {
    setSupportFx((current) =>
      current?.runId === runId ? { ...current, phase: nextPhase } : current
    );
  };

  const playPlayerSupport = async (
    result: Parameters<typeof commitTransition>[0],
    cue: PlayerSupportCue
  ) => {
    const runId = presentation.begin();
    if (runId === null) return;
    setSupportFx({ ...cue, runId, phase: "anticipate" });

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.anticipate), runId))) return;
    setSupportPhase(runId, "release");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.release), runId))) return;
    commitTransition(result);
    setHeldActor(null);
    setSupportPhase(runId, "impact");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.impact), runId))) return;
    setSupportPhase(runId, "settle");

    if (!(await presentation.wait(effectFrameDuration(SUPPORT_TIMING.settle), runId))) return;
    setSupportFx((current) => (current?.runId === runId ? null : current));
    presentation.complete(runId);
  };

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

  const presentedEnemies = engine.enemies.filter(
    (enemy) =>
      !isEnemyDefeated(enemy) ||
      enemy.id === attackFx?.targetId ||
      enemy.id === enemyTurnFx?.enemyId
  );
  const enemyLayoutKey = presentedEnemies.map((enemy) => enemy.id).join("|");

  const registerEnemyNode = useCallback((enemyId: string, node: HTMLElement | null) => {
    if (node) enemyNodesRef.current.set(enemyId, node);
    else enemyNodesRef.current.delete(enemyId);
  }, []);

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
    // presentedEnemies is deliberately represented by the stable identity key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemyLayoutKey]);

  const resetPresentation = () => {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    rollTimerRef.current = null;
    if (layerClearTimerRef.current !== null) window.clearTimeout(layerClearTimerRef.current);
    layerClearTimerRef.current = null;
    presentation.cancel();
    setAttackFx(null);
    setSupportFx(null);
    setEnemyTurnFx(null);
    controller.restart();
    setVisuals(createInitialVisuals());
  };

  return {
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
    isBusy: presentation.isBusy,
    animateDice,
    playPlayerAttack,
    playPlayerSupport,
    playEnemyTurn,
    resetPresentation
  };
}
