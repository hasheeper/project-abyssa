import type { manorClientFixture } from "./manor";
import type { DemoJourneyView } from "../../game-runtime/demo-journey-view";
import type { DemoBattleCommand } from "../../game-core/battle";

type Fixture = Awaited<ReturnType<typeof manorClientFixture>>;
export const journeyOf = (f: Fixture) => f.runtime.queries.journey(f.session.getSnapshot().record!)!;
/** Play public commands to a checkpoint; never fabricate room, dice, HP or RNG state. */
export async function playToJourney(f: Fixture, stop: (view: DemoJourneyView) => boolean) {
  for (let step = 0; step < 800; step++) {
    const v = journeyOf(f), e = v.expedition!, runRef = {kind: "expedition" as const, id: e.run.id};
    if (stop(v)) return v;
    const send = (command: DemoBattleCommand) => f.session.dispatch({type: "battle-command", runRef, command});
    let result;
    if (e.node === "finished") throw Error("Run finished before checkpoint");
    if (e.node === "room-complete") result = await f.session.dispatch({type: "advance-room", runRef, roomId: v.roomId!});
    else if (e.node === "event") result = await f.session.dispatch({type: "choose-event", runRef, roomId: v.roomId!, choiceId: v.event?.kind === "relic" ? "skip" : "read", actorId: null});
    else if (e.node === "exit") result = await f.session.dispatch({type: "choose-exit", runRef, roomId: v.roomId!, choice: "continue"});
    else {
      const heal = v.supplies.find(s => (s.definition.kind === "potion" || s.definition.kind === "food") && s.targets.length);
      const unloaded = v.party.find(m => m.hp > 0 && m.die && !m.die.loaded && !m.die.spent && !m.die.sealed);
      if (heal) result = await f.session.dispatch({type: "use-item", runRef, instanceId: heal.instanceId, target: heal.targets[0]});
      else if (v.battle!.phase === "roll") result = await send({type: "roll"});
      else if (unloaded) result = await send({type: "toggle-load", actorId: unloaded.id});
      else {
        const options = v.party.flatMap(m => m.actions.options.map(o => {
          const enemy = v.battle!.enemies.find(e => e.id === o.targetId);
          const member = v.party.find(p => p.id === o.targetId);
          const threat = member ? v.battle!.enemies.filter(e => e.intent?.targetId === member.id).reduce((n,e) => n + e.damage, 0) : 0;
          const damage = "damage" in o && o.damage && typeof o.damage === "object" && "applied" in o.damage ? Number(o.damage.applied) : o.amount;
          const score = o.choice === "attack" && enemy ? 50 + Math.min(damage, enemy.hp)*3 + (damage >= enemy.hp ? 30 + enemy.damage*5 : 0)
            : o.choice === "heal" && member && o.amount > 0 ? threat >= member.hp ? 140 + o.amount : 20 + o.amount
            : o.choice === "guard-all" && v.battle!.enemies.some(e => e.damage > 0) ? 115
            : o.choice === "guard" && enemy && enemy.damage > 0 ? v.party.some(p => p.id === enemy.intent?.targetId && p.hp <= enemy.damage) ? 120 : 10 + Math.min(o.amount, enemy.damage) : 0;
          return {score, command: {type: "act" as const, actorId: m.id, choice: o.choice, targetId: o.targetId}};
        })).filter(o => o.score > 0).sort((a,b) => b.score-a.score);
        result = await send(options[0]?.command ?? {type: "end-turn"});
      }
    }
    if (!result) throw Error(JSON.stringify(f.session.getSnapshot().error));
  }
  throw Error("Checkpoint step limit");
}
