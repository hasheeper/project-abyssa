import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import source from "./scenes/first-morning.json";
import { FIRST_MORNING_ENTRIES, FIRST_MORNING_TITLES } from "./first-morning";
import { parseAvgStory } from "../../shared/domain/avg/story";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["actors", "holdMs", "effect", "itemId"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
it("preserves approved dialogue, branches, pages and IDs while staging is revised", () => {
  // Same pre-migration text/identity baseline; staging changes are separately authorized.
  const hash = createHash("sha256").update(JSON.stringify(canonical({ entries: FIRST_MORNING_ENTRIES, titles: FIRST_MORNING_TITLES }))).digest("hex");
  expect(hash).toBe("1b5b525610de2095bf69e22225784f5d090c86c93515c0116f25b289956256f6");
});
it.each([
  ["unknown stage field", (s: any) => { s.nodes[0].frames[0].css = "position:fixed"; }, /unknown field/],
  ["broken durable cursor", (s: any) => { s.nodes[8].cursor = 9; }, /stable array index/],
  ["missing branch", (s: any) => { delete s.nodes[7].variants.C; }, /required/],
  ["future branch choice", (s: any) => { s.nodes[7].choiceId = "morning.choice.training"; }, /earlier choice/],
  ["unknown actor", (s: any) => { s.nodes[2].frames[0].actorId = "stranger"; }, /actorId/],
  ["LLM-style arbitrary emotion", (s: any) => { s.nodes[2].frames[0].emotion = "superhappy"; }, /emotion/],
  ["duplicate authored entrance", (s: any) => { s.nodes[67].frames[0].stage[0].motion = "slide"; }, /motion/],
  ["arbitrary item URL", (s: any) => { s.nodes[71].frames[0].itemId = "https://example.com/image.png"; }, /identifier/],
  ["page identity drift", (s: any) => { s.nodes[0].frames[0].id = "new-id"; }, /identity/],
  ["forbidden player line", (s: any) => { s.player.authoredSpeech = false; }, /player speech/],
] as const)("rejects %s before rendering", (_, mutate, error) => {
  const copy = structuredClone(source); mutate(copy); expect(() => parseAvgStory(copy)).toThrow(error);
});
