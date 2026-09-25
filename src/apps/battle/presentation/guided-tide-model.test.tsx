import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { D5GameRecord } from "../../../game-application";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { tideClientFixture, tideCommand, tideOperation } from "../../../game-client/testing/tide-cave";
import { guidedTideModel, guidedTideObservation, tideGuideAllows } from "./guided-tide-model";
import { tideTutorialModel } from "./tide-tutorial-model";
import { tideEventCopy, tideEventVisible } from "./TideJourneyPanel";
import { LootSettlementView } from "../loot/LootSettlementView";
import { expeditionLootCatalog, expeditionLootView } from "../loot/expedition-loot-view";
import { UiMotionProvider } from "../../../shared/ui/motion/UiMotionProvider";
import { ManorJourneyPanel, ManorJourneyActions } from "./ManorJourneyPanel";
import copy from "../../../content/presentation/tutorial/guided-tide.json";
import tactical from "../../../content/presentation/tutorial/tide-tactical.json";
import { tideOpeningCue, tideImpactCue, tideCueMemory } from "./tide-tactical-cues";
import { committedDemoEvents } from "../../../game-runtime/d5-views";
import { showManorEvent } from "./manor-battle-model";
import type { DemoEvent } from "../../../game-core/battle";

let f: Awaited<ReturnType<typeof tideClientFixture>>;
let event: DemoJourneyView, result: DemoJourneyView, claim: DemoJourneyView;
let multiplierBefore: DemoJourneyView, multiplierAfter: DemoJourneyView;
const cueExamples = new Map<string, {view: DemoJourneyView; event: DemoEvent; events: readonly DemoEvent[]}>();
const openings = new Map<number, DemoJourneyView>();
const checkpoints = new Map<string, DemoJourneyView>();
beforeAll(async () => {f = await tideClientFixture(11); await f.start();},30000);
afterAll(() => f?.session.dispose());
afterEach(cleanup);
const record = () => f.session.getSnapshot().record as D5GameRecord;
const view = () => f.runtime.queries.journey(record())!;

it("maps every authoritative instruction to original controls without executing a step", async () => {
  const mapped = new Set<string>();
  for (let n = 0; n < 160; n++) {
    const v = view(), t = v.tutorial!, op = tideOperation(record());
    if (t.guide?.step) checkpoints.set(t.guide.step.id, v);
    if (tideOpeningCue(v)) openings.set(t.encounter!, v);
    if (t.canClaim) {claim = v; break;}
    expect(op).not.toBeNull();
    expect(tideGuideAllows(v,op!)).toBe(true);
    if (t.guide?.mode === "guided" && t.stage === "active") {
      const before = structuredClone(record());
      const model = guidedTideModel(v,{heldActor:null});
      expect(model?.acknowledge).toBe(false);
      expect(model!.targets).toHaveLength(1);
      expect(model!.contextTargets.every(id => id.startsWith("battle."))).toBe(true);
      expect(model!.text).not.toMatch(/\{\w+\}/);
      expect([...model!.text].length).toBeLessThanOrEqual(110);
      mapped.add(t.guide.step!.input.kind);
      expect(tideGuideAllows(v,{type:"battle",command:{type:"end-turn"}})).toBe(op?.type === "battle" && op.command.type === "end-turn");
      const hidden = {...v,tutorial:{...t,hintsEnabled:false}};
      expect(tideTutorialModel(hidden,null,()=>0)).toBeNull();
      expect(tideGuideAllows(hidden,op!)).toBe(true);
      if (op?.type === "battle" && op.command.type === "act") {
        const c = op.command;
        expect(model!.targets[0]).toBe(`battle.member:${c.actorId}`);
        const target = c.choice === "guard" ? "intent" : c.choice === "heal" ? "member" : "enemy";
        expect(guidedTideModel(v,{heldActor:c.actorId})!.targets).toEqual([`battle.${target}:${c.targetId}`]);
        expect(tideGuideAllows(v,{type:"battle",command:{...c,targetId:"wrong-target"}})).toBe(false);
      }
      if (op?.type === "item") {
        expect(guidedTideModel(v,{heldActor:null,suppliesOpen:true})!.targets).toEqual([`battle.item:${op.instanceId}`]);
        expect(guidedTideModel(v,{heldActor:null,suppliesOpen:true,selectedItem:op.instanceId})!.targets).toEqual([`battle.item-target:${op.instanceId}`]);
      }
      if (op?.type === "event") {
        event = v;
        expect(guidedTideModel(v,{heldActor:null,eventActorId:"elora"})!.targets).toEqual(["battle.event-confirm"]);
        expect(tideGuideAllows(v,{...op,actorId:"kael"})).toBe(false);
      }
      if (op?.type === "tutorial-observe") result = v;
      if (t.guide.step!.id === "T3.R1.focus.kael.fix") {
        expect(model!.text).toContain("两对已成型");
        expect(model!.text).toContain("出过手的骰子仍会保留这手牌");
        expect(model!.targets).toEqual(["battle.die:kael"]);
        expect(model!.contextTargets).toEqual(["battle.hand"]);
      }
      if (t.guide.step!.id === "T3.R1.end") multiplierBefore = v;
      expect(record()).toEqual(before);
    } else expect(tideTutorialModel(v,null,()=>1)).toBeNull(); // no forced Boss actions after orientation
    const batch = await f.send(tideCommand(op!)), after = view();
    if (t.guide?.step?.id === "T3.R1.end") multiplierAfter = after;
    let visible = v;
    for (const receipt of batch.receipts) {
      const events = committedDemoEvents(receipt);
      if (events.some(e => e.type === "dice-rolled")) visible = after;
      for (const e of events) {
        visible = e.type === "event-resolved" ? after : showManorEvent(visible, e, after);
        const cue = tideImpactCue(visible,e,events);
        if (cue) cueExamples.set(cue.text,{view:visible,event:e,events});
      }
    }
  }
  expect(mapped).toEqual(new Set(["roll","fix","act","end-turn","advance","reroll","item","event","observe-result"]));
  expect(claim.tutorial!.guide).toMatchObject({mode:"free",reason:"completed",cursor:48});
  // A readable one-focus card, not the superseded 20-character command fragments.
  for (const step of Object.values(copy.steps)) {
    expect([...step.text].length).toBeLessThanOrEqual(110);
    expect(step.text).toMatch(/[。；]/);
    expect(step.text).not.toMatch(/稳住|记住|金钟罩|\{\w+\}/);
  }
},90000);

it("points to the hand and reward display without making the player read a formula during action", () => {
  const model = guidedTideModel(multiplierBefore,{heldActor:null})!;
  expect(model.targets).toEqual(["battle.end-turn"]);
  expect(model.contextTargets).toEqual(["battle.hand", "battle.multiplier"]);
  expect(model.text).toContain("两对已成型");
  expect(model.text).toContain("收益倍率上涨");
  expect(model.text).toContain("追击");
  expect(model.text).not.toMatch(/×|＋|\d\.\d|品质修正|层深|大地/);
  expect(multiplierBefore.economy).toMatchObject({handFactor:2.7,earthFactor:1.1,layerFactor:1});
  expect(multiplierAfter.economy).toMatchObject({handFactor:3,earthFactor:1.1,layerFactor:1});
});

it("orients toward each real threat or event before controls, acknowledging without a gameplay write", () => {
  const cases = [
    ["T1.R1.roll", "slimes", "battle.enemies"],
    ["T2.R1.roll", "sentries", "battle.enemies"],
    ["T2.R2.roll", "bowReady", "intent:"],
    ["E1.attempt", "event", "battle.event-scene"],
    ["T3.R1.roll", "haulers", "battle.enemies"],
    ["T3.R1.focus.kael.fix", "twoPairs", "battle.hand"],
  ];
  const before = structuredClone(record());
  for (const [step, key, target] of cases) {
    const v = checkpoints.get(step)!;
    expect(v, step).toBeTruthy();
    const original = structuredClone(v), read = new Set<string>();
    const observe = tideTutorialModel(v, null, id => Number(read.has(id)))!;
    expect(observe.id).toContain(`guided.observe.${key}:`);
    expect(observe.acknowledge).toBe(true);
    expect(observe.targets[0]).toContain(target);
    read.add(observe.id);
    expect(tideTutorialModel(v,null,id => Number(read.has(id)))).toEqual(guidedTideModel(v,{heldActor:null}));
    expect(v).toEqual(original);
    expect(guidedTideObservation({...v,tutorial:{...v.tutorial!,hintsEnabled:false}},()=>0)).toBeNull();
    expect(guidedTideObservation({...v,tutorial:{...v.tutorial!,stage:"story"}},()=>0)).toBeNull();
    expect(guidedTideObservation({...v,tutorial:{...v.tutorial!,guide:{...v.tutorial!.guide!,mode:"free",reason:"exited"}}},()=>0)).toBeNull();
  }
  expect(record()).toEqual(before);
  const after = guidedTideObservation(multiplierAfter,()=>0)!;
  expect(after.id).toContain("guided.observe.pairResult:");
  expect(after.text).toContain("诺玛也补上了一记飞刀");
  expect(guidedTideObservation(multiplierBefore,()=>0)).toBeNull();
  const boss = openings.get(4)!;
  expect(guidedTideObservation(boss,()=>0)!.id).toContain("guided.observe.boss:");
  expect(tideTutorialModel(boss,null,()=>1)).toBeNull();
  expect(tideGuideAllows(boss,{type:"battle",command:{type:"roll"}})).toBe(true);
  const notPairs = structuredClone(checkpoints.get("T3.R1.focus.kael.fix")!);
  notPairs.battle!.hand.name = "散牌";
  expect(guidedTideObservation(notPairs,()=>0)).toBeNull();
});

it("matches separate fix, actor and attack copy to the wounded slime and uses current enemy IDs", () => {
  const fix = checkpoints.get("T1.R1.eustice.fix")!, act = checkpoints.get("T1.R1.eustice")!;
  expect(guidedTideModel(fix,{heldActor:null})!.text).toBe(copy.steps.focusFix.text);
  expect(guidedTideModel(act,{heldActor:null})!.text).toBe(copy.steps.focusActor.text);
  expect(guidedTideModel(act,{heldActor:"eustice"})!.text).toBe(copy.steps.focusSlime.text);
  const left = fix.battle!.enemies.find(e=>e.definitionId === "enemy.intro.tide-slime")!;
  expect(left.hp).toBe(2);
  expect(guidedTideModel(fix,{heldActor:null})!.contextTargets).toEqual([`battle.enemy-health:${left.id}`]);
  const bowView = structuredClone(checkpoints.get("T2.R2.roll")!);
  const bow = bowView.battle!.enemies.find(e=>e.definitionId === "enemy.intro.crossbowman")!;
  const knife = bowView.battle!.enemies.find(e=>e.definitionId === "enemy.intro.lookout")!;
  bow.id = "restored-bow-id";
  const model = guidedTideModel(bowView,{heldActor:null})!;
  expect(model.contextTargets).toEqual(["battle.intent:restored-bow-id",`battle.intent:${knife.id}`,"battle.health:eustice"]);
  expect(guidedTideModel(checkpoints.get("T2.R1.keep")!,{heldActor:null})!.text).toBe(copy.steps.keep.text);
  expect(guidedTideModel(checkpoints.get("T2.R1.reroll")!,{heldActor:null})!.text).toBe(copy.steps.findSupport.text);
});

it("shows all four openings and only evidence-backed guard, arrow, event and covenant reactions", () => {
  expect([...openings.keys()]).toEqual([1,2,3,4]);
  expect([...cueExamples.keys()]).toEqual([tactical.guardBow.text,tactical.arrowBlocked.text,tactical.eventStrong.text,tactical.throwingKnife.text]);
  for (const [text, example] of cueExamples) {
    const {view:v,event:e,events} = example;
    expect(tideImpactCue({...v,tutorial:null},e,events)).toBeNull();
    expect(tideImpactCue({...v,party:v.party.map(m=>({...m,hp:0}))},e,events)).toBeNull();
    if (text === tactical.throwingKnife.text) expect(tideImpactCue(v,e,events.filter(x=>x.type!=="covenant-triggered"))).toBeNull();
    if (text === tactical.guardBow.text) {
      const deadKnife = structuredClone(v);
      deadKnife.battle!.enemies.find(x=>x.definitionId==="enemy.intro.lookout")!.hp = 0;
      expect(tideImpactCue(deadKnife,e,events)).toBeNull();
    }
  }
  const strong = cueExamples.get(tactical.eventStrong.text)!;
  for (const method of ["weak","failed","skip"] as const) {
    const e = {...strong.event,payload:{...(strong.event.payload as object),method}};
    expect(tideImpactCue(strong.view,e,[e])?.text ?? null).toBe(method === "weak" ? tactical.eventWeak.text : method === "failed" ? tactical.eventFailed.text : null);
  }
});

it("keeps choice reactions at the same Boss and deduplicates refresh and UNDO without game writes", () => {
  const boss = openings.get(4)!;
  for (const [choice,id] of [["A","bossA"],["B","bossB"],["C","bossC"]] as const) {
    const v = structuredClone(boss);
    v.tutorial!.choices = v.tutorial!.choices.map(c=>c.storyId === "S3-4" ? {...c,choice} : c);
    expect(tideOpeningCue(v)?.text).toBe(tactical[id].text);
    v.battle!.encounter.round = 2;
    expect(tideOpeningCue(v)).toBeNull();
  }
  const stored = new Map<string,string>();
  const storage = {getItem:(k:string)=>stored.get(k) ?? null,setItem:(k:string,v:string)=>{stored.set(k,v);}};
  const cue = tideOpeningCue(boss)!;
  const memory = tideCueMemory("test",storage);
  expect(memory.take(cue)).toEqual(cue);
  expect(memory.take(cue)).toBeNull();
  expect(tideCueMemory("test",storage).take({...cue,key:cue.key.replace("|arrival","|new-event-after-undo")})).toBeNull();
  expect(tideCueMemory("other-save",storage).take(cue)).toEqual(cue);
});

it("uses shared event presentation with no manor text, no implied reward and no preselection", () => {
  expect(tideEventVisible(event)).toBe(true);
  expect(event.tutorial!.encounter).toBeNull();
  render(<ManorJourneyPanel view={event} actorId="" eventCopy={tideEventCopy}/>);
  expect(screen.getByRole("heading",{name:"潮坑落货"})).toBeTruthy();
  expect(screen.getByLabelText("整理伙伴")).toHaveTextContent("选择一名队员");
  expect(document.body).not.toHaveTextContent(/庄园|迎宾簿|遗物/);
  expect(document.body).toHaveTextContent("不消耗战斗骰，无法重掷");
});

it("only reveals committed outcomes and retains observation when hints are hidden", () => {
  const hidden = {...result,tutorial:{...result.tutorial!,hintsEnabled:false}};
  render(<><ManorJourneyPanel view={hidden} actorId="elora" eventCopy={tideEventCopy}/>
    <ManorJourneyActions view={hidden} actorId="elora" busy={false} onChoice={()=>{}} onExit={()=>{}} onAdvance={()=>{}} canAdvance={false} onObserve={()=>{}}/></>);
  expect(screen.getByLabelText("整理结果",{exact:true})).toHaveTextContent("强成功");
  expect(screen.getByLabelText("整理结果",{exact:true})).toHaveTextContent("花费 0 G · 获得 0 G");
  expect(screen.getByRole("button",{name:"确认结果"})).toBeEnabled();
  expect(screen.queryByRole("button",{name:"继续前进"})).toBeNull();
});

it("shows the exact normal return plus fee, never just the 8G fee", () => {
  const loot = expeditionLootView(claim);
  render(<UiMotionProvider preference="reduced"><LootSettlementView receipt={loot.receipt!} catalog={expeditionLootCatalog(claim)} supplies={loot.supplies}
    context={{locationName: "退潮岩窟"}} pendingReward={{label: "追回货物报酬", copper: claim.tutorial!.reward.gold}}
    confirmLabel="领取并返回洋馆" onConfirm={()=>{}}/></UiMotionProvider>);
  expect(screen.getByRole("group", {name: "带回资金 44 G"})).toHaveTextContent("44");
  expect(screen.getByRole("dialog")).toHaveTextContent(/追回货物报酬\s*8\s*G/);
  expect(screen.getByRole("button",{name:"领取并返回洋馆"})).toBeEnabled();
  expect(screen.getByRole("heading", {name: "远征完成"})).toBeInTheDocument();
  expect(document.body).not.toHaveTextContent("不会在领取时再乘一次");
  expect(document.body).not.toHaveTextContent("不受倍率影响");
});
