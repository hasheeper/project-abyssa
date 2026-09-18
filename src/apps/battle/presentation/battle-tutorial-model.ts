import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import copy from "../../../content/presentation/tutorial/battle-basics.json";

/** Read the real selector; this function neither rolls nor commits tutorial completion. */
export function battleTutorialModel(view: DemoJourneyView, heldActor: string | null, readIntent: boolean, firstRound: number) {
  const b=view.battle;
  if(!b || !["roll","act"].includes(b.phase) || !b.enemies.length) return null;
  const make=(key:keyof typeof copy.steps, target:string, acknowledge=false)=>({id:`battle.basics.${key}`,...copy.steps[key],targets:[target],acknowledge});
  if(b.encounter.round>firstRound && b.phase==="roll") return make("next","battle.roll",true);
  if(!readIntent && !view.party.some(m=>m.die?.spent)) {
    const e=b.enemies.find(e=>e.intent?.kind==="attack") ?? b.enemies.find(e=>e.intent);
    if(e) return make("intent",`battle.intent:${e.id}`,true);
  }
  if(b.phase==="roll") return make("roll","battle.roll");
  const held=view.party.find(m=>m.id===heldActor);
  const option=held?.actions.options[0];
  if(option) {
    if(option.choice==="heal") return make("heal",`battle.member:${option.targetId}`);
    if(option.choice==="guard" || option.choice==="guard-all") {
      const target=option.targetId ?? b.enemies.find(e=>e.intent?.kind==="attack")?.id;
      if(target) return make("guard",`battle.intent:${target}`);
    }
    if(option.choice==="attack" || option.choice==="bind") return make(option.choice,`battle.enemy:${option.targetId}`);
  }
  if(view.party.some(m=>m.die?.spent)) return make("end","battle.end-turn");
  const ready=view.party.find(m=>m.actions.options.length);
  if(ready) return make("actor",`battle.member:${ready.id}`);
  const dice=view.party.filter(m=>m.afterFixOptions.length);
  const useful=dice.find(m=>m.afterFixOptions.some(option=>option.choice==="attack")) ?? dice[0];
  if(useful) return make("fix",`battle.die:${useful.id}`);
  if(b.encounter.rerolls>0 && b.eligibleOwnerIds.length) return make("reroll","battle.reroll");
  return make("end","battle.end-turn");
}
