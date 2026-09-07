import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { randomRollDuration } from "../../../shared/presentation/roll/timing";
import { EXPEDITION_DIE_ROLL_MS, getExpeditionDieRotation, nextExpeditionDieRotation, type ExpeditionDieRotation } from "../ExpeditionDie3D";
import { getBattlePhase, getExpeditionStatus, getRoundOutcome, isEnemyDefeated, type CharacterId, type EnemyIntent, type EnemyTurnEvent, type BattleCommand, type ExpeditionState } from "../view";
import { getPlayerAttackCue, getPlayerSupportCue, type PlayerAttackCue, type PlayerSupportCue } from "../controller/presentation-events";
import { useExpeditionBattleController } from "../controller/useExpeditionBattleController";
import { usePresentationQueue } from "../controller/usePresentationQueue";
import { applyVisibleEvents, enemyPresentationGroups } from "./committed-events";
import { battleState } from "../../../game-runtime/views";
import { legacyBattleReaction, useBattleReaction } from "./battle-reactions";

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


function duration(ms: number) { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? Math.min(ms, 60) : ms; }
function initialVisuals(state: ExpeditionState): Record<CharacterId, ExpeditionDieVisual> {
  return Object.fromEntries(state.dice.map(d => [d.ownerId, {
    rotation: getExpeditionDieRotation(d.faceIndex === null ? null : d.faceIndex + 1),
    rolling: false,
    rollDuration: EXPEDITION_DIE_ROLL_MS / 1000,
  }]));
}
/** Plays committed receipts. Every mutation here affects only the visual copy. */
export function useExpeditionBattlePresentation(controller: ReturnType<typeof useExpeditionBattleController>) {
  const reactions = useBattleReaction();
  const presentation = usePresentationQueue();
  const engine = controller.state;
  const [visuals, setVisuals] = useState(() => initialVisuals(engine));
  const [attackFx, setAttackFx] = useState<PlayerAttackFx | null>(null);
  const [supportFx, setSupportFx] = useState<PlayerSupportFx | null>(null);
  const [enemyTurnFx, setEnemyTurnFx] = useState<EnemyTurnFx | null>(null);
  const enemyNodesRef = useRef(new Map<string, HTMLElement>());
  const previousEnemyRectsRef = useRef(new Map<string, DOMRect>());
  useEffect(() => {
    presentation.cancel(); controller.finish(); setAttackFx(null); setSupportFx(null); setEnemyTurnFx(null);
    reactions.clear();
    setVisuals(initialVisuals(controller.getState()));
  }, [controller.generation]);
  const play = async (command: BattleCommand) => {
    const runId = presentation.begin();
    if (runId === null) return;
    try {
      const batch = await controller.submit(command);
      if (!batch || !presentation.isCurrent(runId) || !controller.current(batch)) return;
      if (command.type === "undo") reactions.clear();
      for (const receipt of batch.receipts) reactions.observe(legacyBattleReaction(receipt.events, receipt.requestId));
      const wait = async (ms: number) => (await presentation.wait(duration(ms), runId)) && controller.current(batch);
      for (const receipt of batch.receipts) {
        if (!presentation.isCurrent(runId) || !controller.current(batch)) return;
        const events = receipt.events;
        const roll = events.find(e => e.type === "dice-rolled");
        if (roll) {
          const before = controller.getState();
          const final = battleState(batch.after);
          // Keep the original per-die timing and tumble variation. Plan outside
          // the updater so React replay cannot resample the animation.
          const plan = roll.payload.results.flatMap(result => {
            if (result.sealed || result.faceIndex === null) return [];
            const previousFace = before.dice.find(die => die.ownerId === result.ownerId)?.faceIndex;
            return [{
              ownerId: result.ownerId,
              visual: {
                rotation: nextExpeditionDieRotation(
                  getExpeditionDieRotation(previousFace == null ? null : previousFace + 1),
                  result.faceIndex + 1,
                ),
                rolling: true,
                rollDuration: duration(randomRollDuration() * 1000) / 1000,
              },
            }];
          });
          controller.show(final);
          setVisuals(current => {
            const next = { ...current };
            // The receipt identifies participants, including auto-loaded final rolls.
            // Held, spent, sealed and downed dice receive no animation or new angles.
            for (const entry of plan) next[entry.ownerId] = entry.visual;
            return next;
          });
          const longestRoll = Math.max(0, ...plan.map(entry => entry.visual.rollDuration * 1000));
          if (!(await wait(longestRoll + 80))) return;
          setVisuals(current => Object.fromEntries(Object.entries(current).map(([id, value]) => [id, { ...value, rolling: false }])));
          continue;
        }
        const enemies = enemyPresentationGroups(events);
        if (enemies.some(group => group.cue)) {
          let actionIndex = 0;
          for (const group of enemies) {
            const cue = group.cue;
            if (!cue) { controller.show(applyVisibleEvents(controller.getState(), group.events)); continue; }
            const actionId = runId * 100 + actionIndex++;
            setEnemyTurnFx({ ...cue, runId, actionId, phase: "anticipate" });
            if (!(await wait(120))) return;
            setEnemyTurnFx(fx => fx ? { ...fx, phase: "lunge" } : null);
            if (!(await wait(100))) return;
            setEnemyTurnFx(fx => fx ? { ...fx, phase: "hitstop" } : null);
            if (!(await wait(60))) return;
            controller.show(applyVisibleEvents(controller.getState(), group.events));
            setEnemyTurnFx(fx => fx ? { ...fx, phase: "impact" } : null);
            if (!(await wait(320))) return;
            setEnemyTurnFx(fx => fx ? { ...fx, phase: "recover" } : null);
            if (!(await wait(220))) return;
          }
          setEnemyTurnFx(null);
          continue;
        }
        const attack = getPlayerAttackCue(events), support = getPlayerSupportCue(events);
        if (attack) {
          setAttackFx({ ...attack, runId, phase: "anticipate" });
          if (!(await wait(100))) return;
          setAttackFx(fx => fx ? { ...fx, phase: "hitstop" } : null);
          if (!(await wait(70))) return;
          controller.show(applyVisibleEvents(controller.getState(), events)); controller.holdActor(null);
          setAttackFx(fx => fx ? { ...fx, phase: "impact" } : null);
          if (!(await wait(260))) return;
          setAttackFx(fx => fx ? { ...fx, phase: attack.lethal ? "defeat" : "recover" } : null);
          if (!(await wait(attack.lethal ? 460 : 320))) return;
          setAttackFx(null);
        } else if (support) {
          setSupportFx({ ...support, runId, phase: "anticipate" });
          if (!(await wait(90))) return;
          setSupportFx(fx => fx ? { ...fx, phase: "release" } : null);
          if (!(await wait(120))) return;
          controller.show(applyVisibleEvents(controller.getState(), events)); controller.holdActor(null);
          setSupportFx(fx => fx ? { ...fx, phase: "impact" } : null);
          if (!(await wait(240))) return;
          setSupportFx(fx => fx ? { ...fx, phase: "settle" } : null);
          if (!(await wait(300))) return;
          setSupportFx(null);
        } else controller.show(applyVisibleEvents(controller.getState(), events));
        if (events.some(e => e.type === "layer-cleared" && e.payload.settlement === null) && !(await wait(1200))) return;
      }
    } finally {
      if (presentation.isCurrent(runId)) {
        setAttackFx(null); setSupportFx(null); setEnemyTurnFx(null);
        setVisuals(current => Object.fromEntries(Object.entries(current).map(([id, value]) => [id, { ...value, rolling: false }])));
        presentation.complete(runId); controller.finish();
      }
    }
  };
  const presentedEnemies = engine.enemies.filter(enemy => !isEnemyDefeated(enemy) || enemy.id === attackFx?.targetId || enemy.id === enemyTurnFx?.enemyId);
  const enemyLayoutKey = presentedEnemies.map(enemy => enemy.id).join("|");
  const registerEnemyNode = useCallback((id: string, node: HTMLElement | null) => { if (node) enemyNodesRef.current.set(id, node); else enemyNodesRef.current.delete(id); }, []);
  useLayoutEffect(() => {
    const current = new Map<string, DOMRect>();
    for (const enemy of presentedEnemies) {
      const node = enemyNodesRef.current.get(enemy.id); if (!node) continue;
      const rect = node.getBoundingClientRect(), previous = previousEnemyRectsRef.current.get(enemy.id); current.set(enemy.id, rect);
      if (previous && typeof node.animate === "function") node.animate([{ transform: `translate(${previous.left - rect.left}px, ${previous.top - rect.top}px)` }, { transform: "translate(0, 0)" }], { duration: duration(320), easing: "ease-out" });
    }
    previousEnemyRectsRef.current = current;
  }, [enemyLayoutKey]);
  const phase = enemyTurnFx ? "enemy" : getBattlePhase(engine), status = getExpeditionStatus(engine);
  const layerClearPending = engine.mode.type === "player-turn" && getRoundOutcome(engine) === "layer-cleared";
  const isRolling = Object.values(visuals).some(value => value.rolling);
  const available = controller.ready && !presentation.busy && !layerClearPending;
  return { phase, status, layerClearPending, isRolling, visuals, attackFx, supportFx, enemyTurnFx, presentedEnemies, registerEnemyNode,
    interactive: available && phase === "act" && status === "active", canInitialRoll: available && phase === "roll" && status === "active",
    isBusy: presentation.isBusy, play, reaction: reactions.reaction,
  };
}
