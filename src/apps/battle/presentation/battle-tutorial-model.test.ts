import { afterEach, expect, it } from "vitest";
import { manorClientFixture } from "../../../game-client/testing/manor";
import { battleTutorialModel } from "./battle-tutorial-model";

const fixtures: Awaited<ReturnType<typeof manorClientFixture>>[]=[];
afterEach(()=>fixtures.splice(0).forEach(f=>f.session.dispose()));
it("follows committed roll, fix, target and action, including undo, without changing the record",async()=>{
  const f=await manorClientFixture(19,4);fixtures.push(f);
  const read=()=>f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const ref={kind:"expedition" as const,id:"manor-run"};
  const view=read(),round=view.battle!.encounter.round;
  const before=structuredClone(f.session.getSnapshot().record!);
  expect(battleTutorialModel(view,null,false,round)?.id).toBe("battle.basics.intent");
  expect(battleTutorialModel(view,null,true,round)?.id).toBe("battle.basics.roll");
  expect(f.session.getSnapshot().record).toEqual(before);
  await f.session.dispatch({type:"battle-command",runRef:ref,command:{type:"roll"}});
  const rolled=structuredClone(f.session.getSnapshot().record!);
  // This seed gives the full-health player a healing face: it must not be recommended.
  const fullHealthHealer=read().party.find(m=>m.id==="kael")!;
  expect(fullHealthHealer.faces[fullHealthHealer.die!.faceIndex!].kind).toBe("heal");
  expect(fullHealthHealer.afterFixOptions).toEqual([]);
  const fix=battleTutorialModel(read(),null,true,round)!;
  expect(fix.id).toBe("battle.basics.fix");
  expect(f.session.getSnapshot().record).toEqual(rolled);
  const actorId=fix.targets[0].slice("battle.die:".length);
  await f.session.dispatch({type:"battle-command",runRef:ref,command:{type:"toggle-load",actorId}});
  expect(battleTutorialModel(read(),null,true,round)?.targets).toEqual([`battle.member:${actorId}`]);
  const option=read().party.find(m=>m.id===actorId)!.actions.options[0];
  expect(battleTutorialModel(read(),actorId,true,round)?.targets).toEqual([`battle.enemy:${option.targetId}`]);
  await f.session.dispatch({type:"battle-command",runRef:ref,command:{type:"act",actorId,choice:option.choice,targetId:option.targetId}});
  expect(battleTutorialModel(read(),null,true,round)?.id).toBe("battle.basics.end");
  await f.session.dispatch({type:"undo",runRef:ref});
  expect(battleTutorialModel(read(),null,true,round)?.id).toBe("battle.basics.actor");
});

it("uses the legal guard target rather than offering a generic character shield",async()=>{
  const f=await manorClientFixture(19,4);fixtures.push(f);
  const read=()=>f.runtime.queries.journey(f.session.getSnapshot().record!)!;
  const runRef={kind:"expedition" as const,id:"manor-run"};
  await f.session.dispatch({type:"battle-command",runRef,command:{type:"roll"}});
  await f.session.dispatch({type:"battle-command",runRef,command:{type:"toggle-load",actorId:"elora"}});
  const view=read(),option=view.party.find(m=>m.id==="elora")!.actions.options[0];
  expect(option.choice).toBe("guard");
  const model=battleTutorialModel(view,"elora",true,view.battle!.encounter.round);
  expect(model?.id).toBe("battle.basics.guard");
  expect(model?.targets).toEqual([`battle.intent:${option.targetId}`]);
});
