import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AdvStageProps } from "../shared/presentation/adv/AdvStage";
import { deriveRpStage } from "../shared/ui/patterns/rp-stage";
import { StoryReading } from "./StoryReading";
import { tideStory } from "../content/presentation/tide-cave";

let stage: AdvStageProps;
vi.mock("../shared/presentation/adv/AdvStage",()=>({AdvStage:(props:AdvStageProps)=>{stage=props;return <div data-testid="stage"/>;}}));
afterEach(cleanup);

it("restores the authored cursor, leaves thoughts offstage and never performs a direction note", () => {
  const scene = tideStory("S3-1","final"), onNext = vi.fn(), onSkip = vi.fn();
  const view = render(<StoryReading {...scene} cursor={1} onNext={onNext} onSkip={onSkip}/>);
  expect(stage!.performances?.norma).toBeUndefined();
  expect(stage!.messages.filter(m=>m.kind==="stage")).toHaveLength(1);
  expect(JSON.stringify(stage!.messages)).not.toContain("刀尖");
  view.rerender(<StoryReading {...scene} cursor={2} onNext={onNext} onSkip={onSkip}/>);
  expect(stage!.messages.at(-1)).toMatchObject({kind:"say",actorId:"kael",offstage:true,text:"（……看来他们也没什么余裕。追上不难。）"});
  expect(Object.values(deriveRpStage(stage!.messages,stage!.initialSlots).slots)).not.toContain("kael");
  fireEvent.click(screen.getByRole("button",{name:"显示全文"}));
  expect(onNext).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"下一句"}));
  expect(onNext).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button",{name:"跳过本段对白"}));
  expect(onSkip).toHaveBeenCalledOnce();
});

it("reveals the last line before offering a choice and blocks reading controls during a commit", () => {
  const scene = tideStory("S3-4","final"), onNext = vi.fn(), onSkip = vi.fn(), onChoose = vi.fn();
  const props = {...scene,cursor:scene.lines.length-1,onNext,onSkip,onChoose};
  const view = render(<StoryReading {...props}/>);
  expect(screen.queryByRole("button",{name:"守住出口"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"显示全文"}));
  fireEvent.click(screen.getByRole("button",{name:"堵住退路"}));
  expect(onChoose).toHaveBeenCalledWith("B");
  expect(onNext).not.toHaveBeenCalled();
  view.rerender(<StoryReading {...props} busy/>);
  expect(screen.getByRole("button",{name:"守住出口"})).toBeDisabled();
  expect(screen.getByRole("button",{name:"跳过本段对白"})).toBeDisabled();
});
