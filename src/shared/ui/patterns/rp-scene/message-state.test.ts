import { describe, expect, it } from "vitest";
import type { RpMessage } from "../rp-stage";
import { countTypedChars } from "./RpMessageView";
import { deriveExpressionByActor, deriveLitAux, findCurrentSay } from "./message-state";

const say = (id: string, actorId = "abyssa", expression?: string): RpMessage => ({
  id,
  kind: "say",
  actorId,
  text: id,
  expression
});

describe("RP message state", () => {
  it("finds the latest dialogue without treating auxiliary messages as the speaker", () => {
    const messages: RpMessage[] = [
      say("first"),
      { id: "narration", kind: "narration", text: "wind" },
      say("latest", "alvitr"),
      { id: "system", kind: "system", text: "connected" }
    ];

    expect(findCurrentSay(messages)?.id).toBe("latest");
  });

  it("lights the contiguous auxiliary block after the latest dialogue", () => {
    const messages: RpMessage[] = [
      { id: "old", kind: "narration", text: "old" },
      say("focus"),
      { id: "near-1", kind: "narration", text: "near" },
      {
        id: "near-2",
        kind: "roll",
        label: "check",
        formula: "1d20",
        detail: "12",
        total: 12,
        outcome: "success"
      }
    ];

    expect([...deriveLitAux(messages)]).toEqual(["near-1", "near-2"]);
  });

  it("falls back to the block before the latest dialogue and stops at chapters", () => {
    const messages: RpMessage[] = [
      { id: "outside", kind: "system", text: "outside" },
      { id: "chapter", kind: "chapter", text: "II" },
      { id: "near-1", kind: "narration", text: "near" },
      { id: "near-2", kind: "system", text: "near" },
      say("focus")
    ];

    expect([...deriveLitAux(messages)]).toEqual(["near-2", "near-1"]);
  });

  it("keeps the latest explicit expression for each actor", () => {
    const expressions = deriveExpressionByActor([
      say("a-1", "abyssa", "b"),
      say("b-1", "alvitr", "c"),
      say("a-2", "abyssa"),
      say("a-3", "abyssa", "g")
    ]);

    expect([...expressions]).toEqual([
      ["abyssa", "g"],
      ["alvitr", "c"]
    ]);
  });

  it("counts Unicode code points while excluding whitespace from typing timing", () => {
    expect(countTypedChars("A 😀\n中")).toBe(3);
  });
});
