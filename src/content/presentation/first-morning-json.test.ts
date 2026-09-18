import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import source from "./scenes/first-morning.json";
import { FIRST_MORNING_ENTRIES, FIRST_MORNING_TITLES } from "./first-morning";
import { parseAvgStory } from "../../shared/domain/avg/story";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["actors", "holdMs", "effect", "itemId"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
}
it("preserves the September 12 authored dialogue, branches and presentation identities", () => {
  // User-authorized replacement; exact source coverage is checked independently below.
  const hash = createHash("sha256").update(JSON.stringify(canonical({ entries: FIRST_MORNING_ENTRIES, titles: FIRST_MORNING_TITLES }))).digest("hex");
  expect(hash).toBe("2d510adaf88960ebc74ad534804266da582c8cee34c4a4d764ff0a73ffa08ed3");
});

it("includes every supplied line with the correct speaker, without reading stage labels aloud", () => {
  const raw = readFileSync("docs/design/FIRST_MORNING_SCREENPLAY_SOURCE_2026_09_12.md", "utf8").split("\n---\n\n")[1];
  const names: Record<string,string> = {凯尔:"kael",艾比希斯:"abyssa",玛丽埃塔:"marietta",尤斯缇丝:"eustice",柯萝萝:"kororo",艾洛拉:"elora",诺玛:"norma"};
  const expected: {actorId:string;text:string}[] = [], narration: string[] = [];
  let actorId = "";
  const unquote = (text:string) => text.startsWith("“") && text.endsWith("”") ? text.slice(1,-1) : text;
  for (const line of raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean)) {
    const heading = line.match(/^(凯尔|艾比希斯|玛丽埃塔|尤斯缇丝|柯萝萝|艾洛拉|诺玛)(?:（.*）)?：(.*)$/);
    if (heading) {
      actorId = names[heading[1]];
      if (!heading[2]) continue;
      const text = unquote(heading[2]);
      const inline = text.match(/^([^（]+)（(.+)）$/);
      expected.push({actorId,text:inline?.[1]??text});
      if (inline) narration.push(inline[2]);
    } else if (line.startsWith("“") && line.endsWith("”")) expected.push({actorId,text:unquote(line)});
    else if (/^(旁白|动作)：/.test(line)) narration.push(line.replace(/^(旁白|动作)：/,""));
    else if (line.startsWith("（") && line.endsWith("）")) narration.push(line.slice(1,-1));
  }
  const frames = parseAvgStory(source).nodes.flatMap(n=>n.kind==="branch"?Object.values(n.variants).flat():n.kind==="beat"?n.frames:[]);
  const actual = frames.filter(f=>f.kind==="dialogue").map(f=>({actorId:f.actorId,text:f.text}));
  const sorted = (lines:typeof expected) => lines.map(line=>JSON.stringify(line)).sort();
  expect(expected.length).toBeGreaterThan(80);
  expect(sorted(actual)).toEqual(sorted(expected));
  for (const text of narration) expect(frames.some(f=>f.kind==="narration" && f.text===text),text).toBe(true);
  expect(frames.some(f=>f.effect==="break" || f.sound==="glass")).toBe(false);
  expect(actual.map(f=>f.text).join("\n")).not.toMatch(/情绪：|动作：|嚼嚼动效|凯尔/);
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
