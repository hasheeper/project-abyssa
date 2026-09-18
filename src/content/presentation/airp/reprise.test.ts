import { expect, it } from "vitest";
import { manorRepriseDialogue } from "./reprise";

it("keeps wipe/extraction variants distinct and speaks only through present companions", () => {
  for (const outcome of ["wipe", "extracted"] as const) for (const id of ["eustice", "elora", "kororo", "norma"]) {
    const party = ["kael", id], lines = manorRepriseDialogue(outcome, party, party);
    expect(lines.filter(l => l.characterId).map(l => l.characterId)).toEqual([id]);
    expect(lines[0].text).toContain(outcome === "wipe" ? "败退" : "撤离");
  }
});
it("briefs newcomers on screen without fabricating shared experience or a player line", () => {
  const lines = manorRepriseDialogue("wipe", ["kael", "eustice"], ["kael"]);
  expect(lines.some(l => l.kind === "action" && l.text.includes("说明上次经过"))).toBe(true);
  expect(lines.find(l => l.characterId === "eustice")!.text).toContain("听明白了");
  expect(lines.some(l => l.characterId === "kael")).toBe(false);
  expect(manorRepriseDialogue("extracted", ["kael"], ["kael", "elora"]).every(l => !l.characterId)).toBe(true);
});
