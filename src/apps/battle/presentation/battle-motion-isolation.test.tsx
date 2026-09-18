import type { ComponentProps } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { TutorialProvider } from "../../../shared/tutorial";
import * as tutorialStore from "../../../shared/tutorial/store";
import { ExpeditionBattleSurface } from "./ExpeditionBattleSurface";

const {frameRender}=vi.hoisted(()=>({frameRender:vi.fn()}));
vi.mock("./ExpeditionBattleFrame",async importOriginal=>{
  const actual=await importOriginal<typeof import("./ExpeditionBattleFrame")>();
  return {...actual,ExpeditionBattleFrame:(props:ComponentProps<typeof actual.ExpeditionBattleFrame>)=>{
    frameRender();
    return <actual.ExpeditionBattleFrame {...props}/>;
  }};
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});

it("hover updates neither frame nor party/dice, and never churns tutorial anchors",()=>{
  vi.stubGlobal("requestAnimationFrame",vi.fn(()=>1));
  vi.stubGlobal("cancelAnimationFrame",vi.fn());
  const create=vi.spyOn(tutorialStore,"createTutorialStore");
  const partyRead=vi.fn(()=>true);
  const Dice=vi.fn(()=><div data-testid="dice"/>);
  const props:ComponentProps<typeof ExpeditionBattleSurface>={
    label:"test",onSettle:vi.fn(),uiSkin:"timber",phase:"act",layerClearPending:false,
    isRolling:false,interactive:true,heldActor:null,attackFx:null,supportFx:null,enemyTurnFx:null,
    isPresentationBusy:()=>false,handleMemberCardClick:vi.fn(),handleEnemyClick:vi.fn(),handleIntentClick:vi.fn(),
    party:[{id:"kael",hp:5,maxHp:5,returnHp:5,downed:false,shield:0,get ready(){return partyRead();},healable:false,incoming:{raw:1,final:1}}],
    presentedEnemies:[{id:"a",name:"候席客",art:"guest",artUrl:"/guest.png",hp:3,maxHp:3,attack:1,
      blocked:0,intent:null,defeated:false,frenzyWarning:null,frenzyActive:false,threat:null,targetable:true,intentBlockable:false}],
    dicePanel:<Dice/>,sidebar:null,overlays:null,
  };
  const {container,rerender,unmount}=render(<TutorialProvider><ExpeditionBattleSurface {...props}/></TutorialProvider>);
  const store=create.mock.results[0].value as ReturnType<typeof tutorialStore.createTutorialStore>;
  const revision=store.getSnapshot().revision;
  const counts=[frameRender.mock.calls.length,partyRead.mock.calls.length,Dice.mock.calls.length];
  const stage=container.querySelector(".abyssa-expedition-enemies")!;
  const target=container.querySelector(".abyssa-expedition-enemy")!;
  fireEvent.pointerEnter(target,{pointerType:"mouse"});
  expect(stage).toHaveAttribute("data-enemy-previewing","a");
  fireEvent.pointerLeave(target);
  fireEvent.pointerEnter(target,{pointerType:"mouse"});
  expect([frameRender.mock.calls.length,partyRead.mock.calls.length,Dice.mock.calls.length]).toEqual(counts);
  expect(store.getSnapshot().revision).toBe(revision);
  expect(store.anchor("battle.enemies")).toBe(stage);
  // Even an ordinary parent render keeps the combined stage callback stable.
  rerender(<TutorialProvider><ExpeditionBattleSurface {...props} title="changed"/></TutorialProvider>);
  expect(store.getSnapshot().revision).toBe(revision);
  unmount();
  expect(store.anchor("battle.enemies")).toBeUndefined();
});
