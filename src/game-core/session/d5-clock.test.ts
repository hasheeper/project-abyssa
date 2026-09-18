import { expect, it } from "vitest";
import { d5Scenario } from "./testing/d5-fixtures";

it("adds settlement time to manual time rather than resetting to settlement count", () => {
  const s = d5Scenario();
  for (let i = 0; i < 3; i++) s.add({type: "phase-advanced"});
  s.depart("trip"); s.settle();
  expect(s.state().clock).toEqual({day: 2, phase: "dawn"});
  s.add({type: "phase-advanced"});
  expect(s.state().clock).toEqual({day: 2, phase: "day"});
  expect(s.state().settlements).toHaveLength(1);
});

it("cannot wait during a run or an unfinished home story", () => {
  const s = d5Scenario(); s.depart("trip");
  s.add({type: "phase-advanced"}); expect(s.state).toThrow(); s.entries.pop();
  const terminal = s.settle();
  s.add({type: "story-started", sessionId: "story", eventId: "event.growth.elora.lv2", basisId: terminal.id});
  s.add({type: "phase-advanced"}); expect(s.state).toThrow();
});
