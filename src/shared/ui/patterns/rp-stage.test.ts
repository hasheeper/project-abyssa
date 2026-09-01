import { describe, expect, it } from "vitest";
import type { RpMessage } from "./rp-stage";
import { deriveRpStage } from "./rp-stage";

function say(id: string, actorId: string): RpMessage {
  return { id, kind: "say", actorId, text: id };
}

describe("deriveRpStage", () => {
  it("ignores non-dialogue messages when assigning seats", () => {
    const stage = deriveRpStage([
      { id: "chapter", kind: "chapter", text: "I" },
      { id: "system", kind: "system", text: "connected" },
      say("a-1", "a")
    ]);

    expect(stage.slots).toEqual({ left: "a", right: null });
    expect([...stage.sideByMessage]).toEqual([["a-1", "left"]]);
  });

  it("fills the left and right seats in first-speaking order", () => {
    const stage = deriveRpStage([say("a-1", "a"), say("b-1", "b")]);

    expect(stage.slots).toEqual({ left: "a", right: "b" });
    expect(stage.sideByMessage.get("a-1")).toBe("left");
    expect(stage.sideByMessage.get("b-1")).toBe("right");
  });

  it("keeps an existing actor in the same seat", () => {
    const stage = deriveRpStage([
      say("a-1", "a"),
      say("b-1", "b"),
      say("a-2", "a")
    ]);

    expect(stage.slots).toEqual({ left: "a", right: "b" });
    expect(stage.sideByMessage.get("a-2")).toBe("left");
  });

  it("replaces the least-recently-speaking actor while preserving history", () => {
    const stage = deriveRpStage([
      say("a-1", "a"),
      say("b-1", "b"),
      say("a-2", "a"),
      say("c-1", "c"),
      say("d-1", "d")
    ]);

    expect(stage.slots).toEqual({ left: "d", right: "c" });
    expect([...stage.sideByMessage]).toEqual([
      ["a-1", "left"],
      ["b-1", "right"],
      ["a-2", "left"],
      ["c-1", "right"],
      ["d-1", "left"]
    ]);
  });

  it("does not mutate the transcript", () => {
    const messages = [say("a-1", "a"), say("b-1", "b")];
    const snapshot = structuredClone(messages);

    deriveRpStage(messages);

    expect(messages).toEqual(snapshot);
  });
});
