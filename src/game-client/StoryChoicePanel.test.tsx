import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AuthoredUserChoice } from "../content/presentation/authored-story";
import { StoryChoicePanel } from "./StoryChoicePanel";
import { storyActors, storyMessages } from "./story-actors";

const choice:AuthoredUserChoice={
  id:"choice.1",kind:"user-choice",prompt:"怎么处理？",text:"怎么处理？",
  options:[
    {tone:"iron",label:"按住 ·「停。」",action:"{{user}}按住杯子。",line:"停。"},
    {tone:"seasoned",label:"收走 ·「待会儿。」",action:"{{user}}收走杯子。",line:"待会儿。"},
    {tone:"pragmatic",label:"换杯 ·「用这个。」",action:"{{user}}换了杯子。",line:"用这个。"},
  ],
};

it("offers exactly three action choices and returns the selected attitude",()=>{
  const choose=vi.fn(); render(<StoryChoicePanel choice={choice} disabled={false} onChoose={choose}/>);
  expect(screen.getAllByRole("button")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button",{name:/收走/}));
  expect(choose).toHaveBeenCalledWith("seasoned");
});

it("renders only a committed choice as the player placeholder",()=>{
  expect(storyMessages([choice])).toEqual([]);
  expect(storyMessages([choice],new Map([[0,"pragmatic"]]))).toEqual([{id:"choice.1",kind:"say",actorId:"kael",text:"用这个。",expression:undefined}]);
  expect(storyActors([choice]).find(actor=>actor.id==="kael")).toMatchObject({name:"你",secondaryName:"USER"});
});
