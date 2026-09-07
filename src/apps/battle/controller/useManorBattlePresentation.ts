import { committedDemoEvents } from "../../../game-runtime/d5-views";
import { demoBattleReaction, useBattleReaction } from "../presentation/battle-reactions";
import { formationSteps } from "../presentation/formation-motion";
import { manorEventDie, type ManorEventRoll } from "../presentation/manor-event-presentation";
import { JOURNEY_MOTION_MS, type JourneyMotion } from "../presentation/journey-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useGameSession, useGameState } from "../../../game-client/react";
import type { DemoCommand, D5Command, DemoReceipt } from "../../../game-application";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { sameHead } from "../../../game-runtime/views";
import { randomRollDuration } from "../../../shared/presentation/roll/timing";
import {
  getExpeditionDieRotation,
  nextExpeditionDieRotation,
} from "../ExpeditionDie3D";
import { usePresentationQueue } from "./usePresentationQueue";
import type {
  ExpeditionDieVisual,
  PlayerAttackFx,
  PlayerSupportFx,
} from "../presentation/useExpeditionBattlePresentation";
import type { BattleEnemyFx } from "../presentation/battle-surface-model";
import {
  manorBattleModel,
  showManorEvent,
} from "../presentation/manor-battle-model";

export type ManorPlayerCommand = Exclude<
  DemoCommand | D5Command,
  { type: "resume-run" | "start-expedition" }
>;
function duration(ms: number) {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? Math.min(ms, 60)
    : ms;
}
/** Same animation phases and die timing as the original battle, driven by committed Demo receipts. */
export function useManorBattlePresentation() {
  const reactions = useBattleReaction();
  const session = useGameSession(),
    game = useGameState(),
    queue = usePresentationQueue();
  const committed = useMemo(
    () => session.runtime.queries.journey(game.record!)!,
    [session, game.record],
  );
  const [shown, setShown] = useState<DemoJourneyView | null>(null);
  const [rolls, setRolls] = useState<Record<string, ExpeditionDieVisual>>({});
  const [attackFx, setAttackFx] = useState<PlayerAttackFx | null>(null);
  const [supportFx, setSupportFx] = useState<PlayerSupportFx | null>(null);
  const [enemyTurnFx, setEnemyTurnFx] = useState<BattleEnemyFx | null>(null);
  const [heldActor, holdActor] = useState<string | null>(null);
  const [journeyMotion, setJourneyMotion] = useState<JourneyMotion | null>(null);
  const [eventRoll, setEventRoll] = useState<ManorEventRoll | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>()),
    rects = useRef(new Map<string, DOMRect>());
  const motions = useRef(new Set<Animation>());
  const cancelMotions = () => { for (const animation of motions.current) animation.cancel(); motions.current.clear(); };
  const reset = () => {
    cancelMotions();
    setShown(null);
    setRolls({});
    setAttackFx(null);
    setSupportFx(null);
    setEnemyTurnFx(null);
    holdActor(null);
    setJourneyMotion(null);
    setEventRoll(null);
  };
  useEffect(() => {
    queue.cancel();
    reset();
    reactions.clear();
  }, [game.generation]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        queue.cancel();
        reset();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); cancelMotions(); };
  }, [queue.cancel]);
  const perform = async (command: ManorPlayerCommand) => {
    if (session.getSnapshot().status !== "ready") return;
    const runId = queue.begin();
    if (runId === null) return;
    setShown(committed);
    try {
      const batch = await session.dispatch(command);
      if (!batch?.presentable || !queue.isCurrent(runId))
        return;
      if (command.type === "undo") reactions.clear();
      const eventAttempt = command.type === "choose-event" && command.choiceId === "attempt";
      const announce = () => {
        for (const receipt of batch.receipts) reactions.observe(demoBattleReaction(committedDemoEvents(receipt), receipt.requestId));
      };
      // A success/failure line would reveal the event before its die has landed.
      if (!eventAttempt) announce();
      if (document.hidden) return;
      const current = () =>
        queue.isCurrent(runId) &&
        sameHead(session.getSnapshot().record?.head ?? null, batch.after.head);
      const wait = async (ms: number) =>
        (await queue.wait(duration(ms), runId)) && current();
      const after = session.runtime.queries.journey(batch.after)!;
      if (!current()) return;
      const eventDie = eventAttempt ? manorEventDie(after) : null;
      if (eventDie) {
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          const rollDuration = randomRollDuration();
          setEventRoll({...eventDie, phase: "rolling"});
          setRolls({[eventDie.actorId]: {
            rolling: true, rollDuration,
            rotation: nextExpeditionDieRotation(getExpeditionDieRotation(null), eventDie.faceIndex + 1),
          }});
          if (!(await wait(rollDuration * 1000 + 120))) return;
          setRolls({});
          setEventRoll({...eventDie, phase: "checking"});
          if (!(await wait(620))) return;
          setShown(after);
          setEventRoll({...eventDie, phase: "outcome"});
          announce();
          if (!(await wait(700))) return;
        } else announce();
        return;
      }
      // Room changes may have an empty event list. Animate the committed
      // command boundary, keeping the old room visible until arrival.
      if (command.type === "advance-room" || command.type === "choose-exit" && command.choice === "continue") {
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
          setJourneyMotion("walking");
          if (!(await wait(JOURNEY_MOTION_MS.walking))) return;
          if (after.expedition?.node === "battle") {
            // Keep the incoming enemies unmounted until the old scene has
            // completed its zoom/recoil and the white frame is opaque.
            setJourneyMotion("encounter");
            if (!(await wait(JOURNEY_MOTION_MS.encounter))) return;
            setJourneyMotion("flash");
            if (!(await wait(JOURNEY_MOTION_MS.flash))) return;
            setShown(after);
            setJourneyMotion("revealing");
            if (!(await wait(JOURNEY_MOTION_MS.revealing))) return;
          } else {
            setShown(after);
            setJourneyMotion("arriving");
            if (!(await wait(JOURNEY_MOTION_MS.arriving))) return;
          }
        }
        return;
      }
      let visible = committed;
      const apply = (event: DemoReceipt["events"][number]) => {
        visible = showManorEvent(visible, event, after);
        setShown(visible);
      };
      for (const receipt of batch.receipts) {
        if (receipt.version === 1 || !current()) return;
        const events = committedDemoEvents(receipt);
        const roll = events.find((e) => e.type === "dice-rolled");
        if (roll) {
          const plan: Record<string, ExpeditionDieVisual> = {};
          for (const ownerId of (roll.payload as { ownerIds: string[] })
            .ownerIds) {
            const beforeDie = visible.party.find((m) => m.id === ownerId)?.die,
              finalDie = after.party.find((m) => m.id === ownerId)?.die;
            if (finalDie?.faceIndex == null || finalDie.sealed) continue;
            plan[ownerId] = {
              rolling: true,
              rollDuration: duration(randomRollDuration() * 1000) / 1000,
              rotation: nextExpeditionDieRotation(
                getExpeditionDieRotation(
                  beforeDie?.faceIndex == null ? null : beforeDie.faceIndex + 1,
                ),
                finalDie.faceIndex + 1,
              ),
            };
          }
          visible = after;
          setShown(after);
          setRolls(plan);
          if (
            !(await wait(
              Math.max(
                0,
                ...Object.values(plan).map((v) => v.rollDuration * 1000),
              ) + 80,
            ))
          )
            return;
          setRolls({});
          continue;
        }
        const resolution = events.find(
          (e) => e.type === "enemy-intent-resolved",
        );
        if (resolution) {
          const enemy = manorBattleModel(visible, null).enemies.find(
            (e) => e.id === resolution.actorId,
          );
          if (
            enemy?.intent &&
            !events.some(e => e.type === "formation-reordered") &&
            !(resolution.payload as { skipped: boolean }).skipped
          ) {
            const damage = events.find(
              (e) =>
                e.type === "damage-applied" &&
                (e.payload as { targetKind: string }).targetKind ===
                  "party-member",
            );
            const p = damage?.payload as
              | { targetId: string; applied: number; hpAfter: number }
              | undefined;
            const cue: BattleEnemyFx = {
              runId,
              actionId:
                runId * 1000 +
                visible.head.revision +
                (receipt.after?.revision ?? 0),
              enemyId: enemy.id,
              enemyName: enemy.name,
              intentType: enemy.intent.type,
              intent: enemy.intent,
              title: enemy.intent.title,
              targetId: p?.targetId ?? enemy.intent.targetId,
              result: p ? (p.applied ? "hit" : "blocked") : "effect",
              damage: p?.applied ?? 0,
              hpBefore: p ? p.hpAfter + p.applied : null,
              hpAfter: p?.hpAfter ?? null,
              lethal: p?.hpAfter === 0,
              phase: "anticipate",
            };
            setEnemyTurnFx(cue);
            if (!(await wait(120))) return;
            setEnemyTurnFx({ ...cue, phase: "lunge" });
            if (!(await wait(100))) return;
            setEnemyTurnFx({ ...cue, phase: "hitstop" });
            if (!(await wait(60))) return;
            events.forEach(apply);
            setEnemyTurnFx({ ...cue, phase: "impact" });
            if (!(await wait(320))) return;
            setEnemyTurnFx({ ...cue, phase: "recover" });
            if (!(await wait(220))) return;
            setEnemyTurnFx(null);
            continue;
          }
        }
        for (const event of events) {
          const p = event.payload as Record<string, unknown>;
          if (event.type === "formation-reordered") {
            for (const order of formationSteps(p.before as string[], p.after as string[])) {
              apply({...event, payload: {...p, after: order}});
              if (!(await wait(380))) return;
            }
          } else if (event.type === "damage-applied" && p.targetKind === "enemy") {
            const cue: PlayerAttackFx = {
              actorId: event.actorId ?? "",
              targetId: String(p.targetId),
              damage: Number(p.applied),
              lethal: p.hpAfter === 0 && visible.battle?.enemies.find(e => e.id === p.targetId)?.definition.behavior !== "heiress" && visible.battle?.enemies.find(e => e.id === p.targetId)?.definitionId !== "enemy.memory.marietta",
              runId,
              phase: "anticipate",
            };
            setAttackFx(cue);
            if (!(await wait(100))) return;
            setAttackFx({ ...cue, phase: "hitstop" });
            if (!(await wait(70))) return;
            apply(event);
            // Apply the committed linked preview on the hit frame, while the guest's
            // existing defeat animation finishes. Reapplying this absolute delta is harmless.
            const seatChange = events.find(e => e.type === "banquet-seats-changed" && (e.payload as {targetId:string;reason:string}).targetId === p.targetId && (e.payload as {reason:string}).reason === "defeated");
            if (seatChange) apply(seatChange);
            holdActor(null);
            setAttackFx({ ...cue, phase: "impact" });
            if (!(await wait(260))) return;
            setAttackFx({ ...cue, phase: cue.lethal ? "defeat" : "recover" });
            if (!(await wait(cue.lethal ? 460 : 320))) return;
            setAttackFx(null);
          } else if (
            event.type === "healing-applied" ||
            event.type === "guard-applied"
          ) {
            const cue: PlayerSupportFx = {
              kind: event.type === "healing-applied" ? "heal" : "guard",
              actorId: event.actorId ?? "",
              targetId: String(p.targetId),
              amount: Number(p.applied ?? p.amount),
              runId,
              phase: "anticipate",
            };
            setSupportFx(cue);
            if (!(await wait(90))) return;
            setSupportFx({ ...cue, phase: "release" });
            if (!(await wait(120))) return;
            apply(event);
            holdActor(null);
            setSupportFx({ ...cue, phase: "impact" });
            if (!(await wait(240))) return;
            setSupportFx({ ...cue, phase: "settle" });
            if (!(await wait(300))) return;
            setSupportFx(null);
          } else apply(event);
        }
      }
    } finally {
      if (queue.isCurrent(runId)) {
        reset();
        queue.complete(runId);
      }
    }
  };
  const view = shown ?? committed;
  const visuals = Object.fromEntries(
    view.party.map((m) => [
      m.id,
      rolls[m.id] ?? {
        rolling: false,
        rollDuration: 0.9,
        rotation: getExpeditionDieRotation(
          m.die?.faceIndex == null ? null : m.die.faceIndex + 1,
        ),
      },
    ]),
  );
  const model = manorBattleModel(view, heldActor);
  const presentedEnemies = model.enemies.filter(
    (e) =>
      !e.defeated ||
      attackFx?.targetId === e.id ||
      enemyTurnFx?.enemyId === e.id,
  );
  const layoutKey = presentedEnemies.map((e) => e.id).join("|");
  const registerEnemyNode = useCallback(
    (id: string, node: HTMLElement | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    },
    [],
  );
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>();
    for (const enemy of presentedEnemies) {
      const node = nodes.current.get(enemy.id);
      if (!node) continue;
      const rect = node.getBoundingClientRect(),
        before = rects.current.get(enemy.id);
      next.set(enemy.id, rect);
      if (before && node.animate && !document.hidden && (before.left !== rect.left || before.top !== rect.top)) {
        const dx = before.left - rect.left, dy = before.top - rect.top;
        const reorder = before && rects.current.size === presentedEnemies.length && queue.isBusy();
        const animation = node.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px)`,
            },
            ...(reorder ? [{transform: `translate(${dx * 0.5}px, ${dy * 0.5 + (dx > 0 ? -12 : 12)}px)`, offset: 0.5}] : []),
            { transform: "translate(0, 0)" },
          ],
          { duration: duration(reorder ? 360 : 320), easing: reorder ? "cubic-bezier(.25,.1,.25,1)" : "ease-out" },
        );
        motions.current.add(animation);
        animation.onfinish = () => motions.current.delete(animation);
      }
    }
    rects.current = next;
  }, [layoutKey]);
  const busy = queue.busy || game.status !== "ready";
  return {
    reaction: reactions.reaction,
    view,
    memory: game.record?.schemaVersion === 4 ? session.runtime.queries.memory(game.record) : null,
    party: model.party,
    presentedEnemies,
    visuals,
    attackFx,
    supportFx,
    enemyTurnFx,
    heldActor,
    holdActor,
    perform,
    busy,
    isBusy: queue.isBusy,
    registerEnemyNode,
    isRolling: Object.values(rolls).some((v) => v.rolling),
    journeyMotion,
    eventRoll,
  };
}
