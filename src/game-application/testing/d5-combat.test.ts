import { describe, it, expect } from "vitest";
import { createD5MemoryEngine } from "../../game-core/battle/d5-engine";
import type { DemoBattleCommand } from "../../game-core/battle/domain/demo-state";
import { d5Catalog, d5Scenario } from "../../game-core/session/testing/d5-fixtures";
import { projectD5Progress } from "../../game-core/session/d5-progress";
import { D5_RUN_READERS } from "../../game-core/session/d5-run-readers";
import { initialD5Projection } from "../../game-core/session/d5-progress";
import { validateD5CombatEvidence, compactD5CombatEvidence } from "../versions/d5-combat-evidence";
import type { D5CombatEvidence } from "../versions/d5-combat-evidence";
import { validateD5Record, validateD5Receipt, d5FactId, d5EvidenceRunRef, readD5Archive } from "../versions/d5-validate";
import type { D5GameRecord, D5Receipt } from "../versions/d5-contracts";
import type { D5ProgressEntry } from "../../game-core/session/d5-types";

const engine=createD5MemoryEngine(d5Catalog);
function fixture() {
  const scenario=d5Scenario(); scenario.firstClear(); scenario.enterMemory();
  const entries:D5ProgressEntry[]=[],head={saveId:"c-proof",epoch:"e",revision:0};
  const readers={...scenario.readers,memory:D5_RUN_READERS.memory};
  const factId=d5FactId(head.saveId,head.epoch,0,0), profileId=d5Catalog.data.journey!.defaultProfileId;
  const r:D5GameRecord={schemaVersion:4,head,contentRef:d5Catalog.ref,profileId,snapshot:{campaign:initialD5Projection(d5Catalog),run:null},originRef:null,undoAnchors:[],retractedFactIds:[],commits:[{ref:head,previous:null,requestId:"create",kind:"create",factIds:[factId]}],facts:[{version:4,id:factId,source:head,origin:"present",runRef:null,originRef:null,worldTime:{day:1,phase:"dawn"},visibility:"party",kind:"save-created",payload:{profileId}}]};
  for(const entry of scenario.entries) {
    const source={...head,revision:entry.revision},id=d5FactId(head.saveId,head.epoch,source.revision,0);
    const proof={...entry,id};
    r.facts.push({version:4,id,source,origin:entry.origin,runRef:d5EvidenceRunRef(entry.event),originRef:null,worldTime:projectD5Progress(d5Catalog,entries,readers).clock,visibility:"party",kind:"progression",payload:entry.event});
    r.commits.push({ref:source,previous:r.head,requestId:`progress:${source.revision}`,kind:entry.event.type,factIds:[id]});r.head=source;entries.push(proof);
  }
  r.snapshot={campaign:structuredClone(projectD5Progress(d5Catalog,entries,readers)),run:{kind:"memory",id:"memory-one",attempt:1,battle:engine.create({runId:"memory-one",seed:41})}};
  function append(command:DemoBattleCommand,retracts:string[]=[]) {
    if(r.snapshot.run?.kind!=="memory" || !r.snapshot.run.battle) throw Error("fixture");
    const before=structuredClone(r.snapshot.run.battle),resolution=engine.dispatch(before,command), source={...r.head,revision:r.head.revision+1};
    const id=d5FactId(source.saveId,source.epoch,source.revision,0);
    const proof:D5CombatEvidence={runRef:{kind:"memory",id:before.run.id,attempt:1},operation:{kind:"command",command},before,after:resolution.state,events:resolution.events,retracts};
    r.facts.push({version:4,id,source,origin:"memory",runRef:proof.runRef,originRef:null,worldTime:r.snapshot.campaign.clock,visibility:"party",kind:"combat",payload:compactD5CombatEvidence(proof)});
    r.commits.push({ref:source,previous:r.head,requestId:`combat:${source.revision}`,kind:"combat",factIds:[id]});
    r.head=source;r.snapshot.run.battle=resolution.state;r.retractedFactIds.push(...retracts);
    if(resolution.state.encounter.phase==="complete") {
      const completionId=d5FactId(source.saveId,source.epoch,source.revision,1);
      const entry:D5ProgressEntry={id:completionId,revision:source.revision,origin:"memory",event:{type:"memory-ended",terminal:{id:`terminal:${before.run.id}`,runRef:{kind:"memory",id:before.run.id,attempt:1},chapterId:d5Catalog.data.progression.chapter.id,templateId:d5Catalog.data.progression.chapter.templateId,finalBattle:resolution.state}}};
      r.facts.push({version:4,id:completionId,source,origin:"memory",runRef:proof.runRef,originRef:null,worldTime:r.snapshot.campaign.clock,visibility:"party",kind:"progression",payload:entry.event});
      r.commits.at(-1)!.factIds.push(completionId);entries.push(entry);
      r.snapshot.campaign=structuredClone(projectD5Progress(d5Catalog,entries,readers));
    }
    return {id,proof};
  }
  return {record:r,readers,append};
}

describe("D5-C committed combat evidence",()=>{
  it("replays real combat across a v4 record/archive and retracts exactly the prior action group",()=>{
    const f=fixture();f.append({type:"roll"});const action=f.append({type:"toggle-load",actorId:"kael"});
    f.append({type:"undo"},[action.id]);
    const record=validateD5Record(f.record,d5Catalog,f.readers);
    expect(record.retractedFactIds).toEqual([action.id]);
    expect(readD5Archive(JSON.stringify({archiveVersion:4,record}),d5Catalog,f.readers)).toEqual(record);
  });
  it.each(["events","state","attempt","before","retraction","snapshot"])("rejects altered %s",field=>{
    const f=fixture();f.append({type:"roll"});const a=f.append({type:"toggle-load",actorId:"kael"});
    const last=f.record.facts.at(-1)!;if(last.kind!=="combat") throw Error("fixture");
    if(field==="events") last.payload.events=[];
    if(field==="state") last.payload.afterDigest="0".repeat(64);
    if(field==="attempt") {last.payload.runRef={kind:"memory",id:"memory-one",attempt:2};last.runRef=last.payload.runRef;}
    if(field==="before") last.payload.beforeDigest="0".repeat(64);
    if(field==="retraction") {f.append({type:"undo"},["unrelated-progress-grant"]);}
    if(field==="snapshot" && f.record.snapshot.run?.kind==="memory") f.record.snapshot.run.battle!.run.sequence++;
    expect(a.id).toBeTruthy();expect(()=>validateD5Record(f.record,d5Catalog,f.readers)).toThrow();
  });
  it("requires a terminal battle and completion in the same receipt",()=>{
    let before=engine.dispatch(engine.create({runId:"terminal",seed:2}),{type:"roll"}).state;
    before.encounter.enemies[0].hp=1;before.encounter.dice[1].faceIndex=1;before.encounter.dice[1].loaded=true;
    before=engine.dispatch(before,{type:"act",actorId:"eustice",choice:"attack",targetId:before.encounter.enemies[0].id}).state;
    const result=engine.dispatch(before,{type:"end-turn"}),head={saveId:"x",epoch:"e",revision:8};
    const proof:D5CombatEvidence={runRef:{kind:"memory",id:"terminal",attempt:1},operation:{kind:"command",command:{type:"end-turn"}},before,after:result.state,events:result.events,retracts:[]};
    expect(validateD5CombatEvidence(d5Catalog,proof)).toEqual(proof);
    const id=d5FactId("x","e",8,1),entry:D5ProgressEntry={id,revision:8,origin:"memory",event:{type:"memory-ended",terminal:{id:"terminal:memory",runRef:{kind:"memory",id:"terminal",attempt:1},chapterId:d5Catalog.data.progression.chapter.id,templateId:d5Catalog.data.progression.chapter.templateId,finalBattle:result.state}}};
    const receipt:D5Receipt={version:4,contentRef:d5Catalog.ref,saveId:"x",epoch:"e",requestId:"end",fingerprint:"0".repeat(64),status:"committed",before:{...head,revision:7},after:head,error:null,events:[entry],factIds:[d5FactId("x","e",8,0),id],combat:proof};
    expect(validateD5Receipt(receipt,d5Catalog,D5_RUN_READERS)).toEqual(receipt);
    expect(()=>validateD5Receipt({...receipt,events:[],factIds:receipt.factIds.slice(0,1)},d5Catalog,D5_RUN_READERS)).toThrow();
  });
  it("archives an entire played memory with its atomic ending and no half-complete snapshot",()=>{
    const f=fixture();let steps=0;
    const state=()=>{const run=f.record.snapshot.run;if(run?.kind!=="memory"||!run.battle)throw Error("fixture");return run.battle;};
    while(state().encounter.phase!=="complete"&&steps++<250) {
      const enc=state().encounter;
      if(enc.phase==="roll"){f.append({type:"roll"});continue;}
      if(enc.phase==="enemy"){f.append({type:enc.cursor<enc.enemyOrder.length?"resolve-next-enemy":"next-round"});continue;}
      for(const id of ["kororo","eustice","elora","kael","norma"]) {
        const s=state();if(s.encounter.memory!.defeated)break;
        const die=s.encounter.dice.find(d=>d.ownerId===id)!;
        if(die.spent||die.sealed||!s.run.party.some(m=>m.id===id&&m.hp>0))continue;
        if(!die.loaded)f.append({type:"toggle-load",actorId:id});
        const options=engine.select(state()).party.find(m=>m.id===id)!.actions.options;
        const option=options.find(o=>o.choice==="heal"&&state().run.party.find(m=>m.id===o.targetId)!.hp===1)??options.find(o=>o.choice==="attack")??options[0];
        if(option)f.append({type:"act",actorId:id,choice:option.choice,targetId:option.targetId});
      }
      f.append({type:"end-turn"});
    }
    expect(steps).toBeLessThan(250);
    expect(f.record.commits.at(-1)!.factIds).toHaveLength(2);
    const serialized=JSON.stringify({archiveVersion:4,record:f.record});
    expect(serialized.length).toBeLessThan(200000);
    expect(readD5Archive(serialized,d5Catalog,f.readers)).toEqual(f.record);
    const partial=structuredClone(f.record);partial.facts.pop();partial.commits.at(-1)!.factIds.pop();
    expect(()=>validateD5Record(partial,d5Catalog,f.readers)).toThrow();
  },45000);
});
