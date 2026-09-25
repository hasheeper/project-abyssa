import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AdvStage } from "./AdvStage";
import { SceneSequence } from "./SceneSequence";
import { EMOTION_LABELS, type CharacterEmotionProfile } from "../../domain/presentation/emotion";
import type { RpActor, RpMessage } from "../../ui/patterns/rp-stage";

const profile: CharacterEmotionProfile = {
  direction: "test",
  cues: Object.fromEntries(Object.keys(EMOTION_LABELS).map(id => [id, {
    expression: id === "joy" ? "c" : "a",
    emote: id === "joy" ? "note" : null,
    motion: id === "joy" ? {id:"nod",amplitude:30,duration:820} : null,
  }])) as CharacterEmotionProfile["cues"],
};
const actors: RpActor[] = [{id:"elora",name:"艾洛拉",emotionProfile:profile}];
const line: RpMessage = {id:"line-1",kind:"say",actorId:"elora",emotion:"joy",text:"知道了。"};
let animate: ReturnType<typeof vi.fn>, cancel: ReturnType<typeof vi.fn>;
const advance = (ms:number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers(); cancel=vi.fn(); animate=vi.fn(()=>({cancel}));
  vi.stubGlobal("matchMedia",vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
  vi.spyOn(document,"hidden","get").mockReturnValue(false);
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:animate});
});
afterEach(() => {
  cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

it.each(["natural", "reveal"])("starts the emotion with short dialogue and does not restart on %s completion", mode => {
  const done=vi.fn();
  const view=render(<StrictMode><AdvStage actors={actors} messages={[]} typing/></StrictMode>);
  const stage=(typing:boolean)=><StrictMode><AdvStage actors={actors} messages={[line]} typing={typing} onTypingEnd={done}/></StrictMode>;
  view.rerender(stage(true));
  advance(0);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".abyssa-emote")).not.toBeNull();
  expect(done).not.toHaveBeenCalled();
  advance(28);
  expect(view.container.querySelector(".abyssa-dialogue__content")).toHaveTextContent(/^知$/);
  if(mode==="reveal") view.rerender(stage(false));
  else advance(28 * 3);
  expect(done).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".abyssa-dialogue__content")).toHaveTextContent("知道了。");
  expect(animate).toHaveBeenCalledTimes(1);
  expect(cancel).not.toHaveBeenCalled();
  advance(1000);
  expect(animate).toHaveBeenCalledTimes(1);
});

it("starts an authored gesture while a newly arriving actor's dialogue is typing", () => {
  const done=vi.fn();
  const view=render(<StrictMode><AdvStage actors={actors} messages={[line]} typing onTypingEnd={done}
    performances={{elora:{key:line.id,motion:"nod"}}}/></StrictMode>);
  advance(28);
  expect(animate).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
  expect(view.container.querySelector(".abyssa-dialogue__content")).toHaveTextContent(/^知$/);
  expect(view.container.querySelector(".abyssa-emote")).toBeNull();
});

it("does not mistake a fresh scene entrance for restored emotion history", () => {
  const view=render(<StrictMode><SceneSequence frame={{id:"scene",kind:"adv",content:
    <AdvStage actors={actors} messages={[line]} typing/>
  }}/></StrictMode>);
  advance(28);
  expect(view.container.querySelector('[data-character="elora"]')).toHaveAttribute("data-settled");
  expect(animate).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector(".abyssa-dialogue__content")).toHaveTextContent(/^知$/);
});

it("does not replace the AVG dialogue or speaker with a saved choice record", () => {
  const messages: RpMessage[] = [line, {id:"choice",kind:"choice",text:"故意找茬",sequence:2}];
  const view=render(<AdvStage actors={actors} messages={messages} typing={false} hydrate/>);
  expect(view.container.querySelector(".abyssa-dialogue__content")).toHaveTextContent("知道了。");
  expect(view.container.querySelector(".rp-adv__dialogue")).not.toHaveTextContent("故意找茬");
});

it("does not spotlight silent still poses or flicker when their cue is suspended during a save", () => {
  const narration: RpMessage = {id:"hold",kind:"narration",text:"她合上账本。"};
  const still = {elora:{key:narration.id,still:true}};
  const draw = (withCue: boolean, speaking = false) => <AdvStage actors={actors} initialSlots={{left:"elora"}}
    messages={[speaking ? line : narration]} performances={withCue ? still : undefined} typing={false} hydrate/>;
  const view = render(draw(true));
  const actor = view.container.querySelector('.rp-adv__actor[data-character="elora"]');
  expect(actor).toHaveAttribute("data-active", "false");
  for (const withCue of [false, true]) {
    view.rerender(draw(withCue));
    expect(view.container.querySelector('.rp-adv__actor[data-character="elora"]')).toBe(actor);
    expect(actor).toHaveAttribute("data-active", "false");
  }
  view.rerender(draw(true, true));
  expect(actor).toHaveAttribute("data-active", "true");
});
