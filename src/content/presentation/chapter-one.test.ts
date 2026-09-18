import { expect, it } from "vitest";
import manuscript from "../../../docs/design/CHAPTER_ONE_SCREENPLAY_SOURCE_2026_09_15.md?raw";
import { TIDE_CHAPTER_ONE_STORY, tideStory, tideStoryEdition } from "./tide-cave";
import { EMOTION_LABELS } from "../../shared/domain/presentation/emotion";

const story=TIDE_CHAPTER_ONE_STORY;
const beats=story.nodes.filter(node=>node.kind==="beat");
const frames=beats.flatMap(node=>node.kind==="beat" ? node.frames : []);

// The source document is the historical bilingual manuscript. Only its Chinese
// wording is published; scan balanced brackets to preserve thoughts and asides.
function chineseWording(raw: string, thought: boolean) {
  const text = thought ? raw.slice(1,-1) : raw;
  let depth = 0;
  if (!text.endsWith("）")) throw Error("Missing Chinese translation");
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "）") depth++;
    if (text[i] === "（" && --depth === 0) {
      const translation = text.slice(i+1,-1);
      return thought ? `（${translation}）` : translation;
    }
  }
  throw Error("Unbalanced manuscript translation");
}

it("publishes only the approved Chinese wording, preserving narration and silent player actions", () => {
  const expected=manuscript.split("\n").flatMap(raw=>{
    const line=raw.trim();
    if (line.startsWith("旁白：")) return [line.slice(3)];
    const spoken=line.match(/^(?:诺玛|尤斯缇丝|艾洛拉|柯萝萝|玛丽埃塔|艾比希斯|\{\{user\}\})（.+?）：\s*(.*)$/);
    if (spoken) return [chineseWording(spoken[1].replace(/^「|」$/g,""),line.startsWith("{{user}}"))];
    return line.startsWith("{{user}}（") ? [line] : [];
  });
  expect(frames.map(frame=>"text" in frame ? frame.text : "")).toEqual(expected);
  expect(frames).toHaveLength(78);
  expect(story.locale).toBe("zh-CN");
  expect(JSON.stringify(story)).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
  for (const frame of frames) if (frame.kind==="dialogue") {
    expect(Object.hasOwn(EMOTION_LABELS,frame.emotion!)).toBe(true);
    if (frame.actorId==="kael") expect(frame.text.startsWith("（")).toBe(true);
    else expect(frame.text).not.toMatch(/^（[\s\S]*）$/);
    for (const cue of frame.stage ?? []) expect(cue.actorId).toBe(frame.actorId);
  }
});

it("retains meaningful Chinese thought and action brackets, not translation wrappers", () => {
  const text = (id: string) => {
    const frame = frames.find(frame=>frame.id===id);
    return frame && "text" in frame ? frame.text : undefined;
  };
  expect(text("S3-1.screen.1.page.1")).toBe("拖痕里的水还没退。……刚钻进去没多久，BOSS。慌得很。");
  expect(text("S3-1.screen.1.page.2")).toBe("（……看来他们也没什么余裕。追上不难。）");
  expect(text("S3-3.screen.1.page.4")).toBe("（把缩回来的脚尖藏进袍子底下，视线微晃）……没有啦。……就只是想坐着而已。");
  expect(text("S4-1.screen.3.page.4")).toBe("……（耸了耸鼻尖轻嗅）……。");
  expect(text("S4-1.screen.3.page.9")).toBe("……（蹭蹭）……。");
});

it("keeps six scenes of three screens, the three cargo choices and S4-1 as the real ending", () => {
  expect(story.sections.map(section=>section.id)).toEqual(["S3-1","S3-2","S3-3","S3-4","S3-5","S4-1"]);
  for (const section of story.sections) {
    const screens=beats.filter(node=>node.sectionId===section.id);
    expect(screens.map(node=>node.id)).toEqual([1,2,3].map(screen=>`${section.id}.screen.${screen}`));
    expect(tideStory(section.id,"final").lines.map(line=>line.id)).toEqual(screens.flatMap(node=>node.kind==="beat" ? node.frames.map(f=>f.id) : []));
  }
  expect(tideStory("S3-4","final").choice?.options).toEqual([
    {id:"A",label:"守住出口"},{id:"B",label:"堵住退路"},{id:"C",label:"先检查货物"}
  ]);
  expect(tideStory("S4-1","final").isFinal).toBe(true);
  expect(()=>tideStory("S4-2","final")).toThrow();
  expect(tideStory("S4-1","final").lines.at(-1)?.text).toBe("黑泥缓缓收回阴影，只留下一层沉甸甸的暖意与重量。壁炉的火光跳跃着，门内彻底安静了下来。");
});

it("keeps published reading editions separate and stages only the authored performance cues", () => {
  expect([7,9,10,11,12].map(tideStoryEdition)).toEqual(["legacy","legacy","legacy","guided","final"]);
  expect(tideStory("S4-2","guided").isFinal).toBe(true);
  expect(tideStory("S3-1","guided").revision).toBe("g4-1");
  expect(tideStory("S3-1","final").revision).toBe("chapter-one-1");
  const norma=tideStory("S3-3","final").lines.find(line=>line.characterId==="norma")!;
  expect(norma.actors).toMatchObject([{characterId:"norma",emotion:"wry"}]);
  expect(norma.actors?.[0].direction).toContain("撬针");
  expect(norma.actors?.[0].aside).toBeUndefined();
});
