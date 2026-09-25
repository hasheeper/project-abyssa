import { expect, it } from "vitest";
import { flowDisplayReducer, type FlowDisplay } from "./contracts";

it.each([
  ["exited","expanded","prepared"], ["prepared","exited","expanded"], ["expanded","prepared","exited"],
] as const)("joins panel exit, room expansion and reader preparation in any order (%s, %s, %s)", (first,second,last) => {
  let state:FlowDisplay=flowDisplayReducer({phase:"open",key:"scene"},{type:"read",key:"scene"});
  expect(state.phase).toBe("entering-reader");
  for(const type of [first,second]) {
    state=flowDisplayReducer(state,{type,key:"scene"});
    expect(state.phase).toBe("entering-reader");
  }
  state=flowDisplayReducer(state,{type:last,key:"scene"});
  expect(state).toEqual({phase:"reader",key:"scene",entrance:"dissolve"});
});
it("ignores late callbacks and cancels a handoff when its reading owner closes", () => {
  const start=flowDisplayReducer({phase:"open",key:"a"},{type:"read",key:"a"});
  expect(flowDisplayReducer(start,{type:"prepared",key:"old"})).toBe(start);
  const cancelled=flowDisplayReducer(start,{type:"leave-reader",key:"a"});
  expect(cancelled.phase).toBe("background");
  expect(flowDisplayReducer(cancelled,{type:"expanded",key:"a"})).toBe(cancelled);
});
