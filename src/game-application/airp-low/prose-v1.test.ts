import {expect, it} from "vitest";
import {lowR8Source} from "../../content/presentation/airp/low-r8-source";
import {compileLowFrame, validateLowFrame} from "./native";
import {PROSE_ROLEPLAY_ID, PROSE_SETTING_ID} from "./prose-v1";

const scene = {id: "prose-v1", actors: {elora: "艾洛拉"}, player: {id: "kael", name: "凯尔"}, scenario: "洋馆中的当前交流。", userInput: "回应玩家实际态度。"};
const joined = (f: ReturnType<typeof compileLowFrame>) => f.messages.map(m => m.content).join("\n");

it("opts into contextual character rules while retaining the full sources, ICOT, order and sampling", () => {
  const source = structuredClone(lowR8Source), old = compileLowFrame(source, scene, true, 6);
  const revised = compileLowFrame(source, {...scene, proseVersion: 1}, true, 6);
  expect(revised.trace.map(t => t.id)).toEqual(old.trace.map(t => t.id));
  expect(revised.trace.filter((t, i) => t.contentHash !== old.trace[i].contentHash).map(t => t.id).sort()).toEqual([PROSE_ROLEPLAY_ID, PROSE_SETTING_ID].sort());
  expect(revised.sources).toEqual(old.sources); expect(revised.briefs).toEqual(old.briefs);
  expect(revised.sampling).toEqual(old.sampling); expect(revised.formatInstruction).toBe(old.formatInstruction);
  expect(revised.materialHash).toBe(old.materialHash); expect(source).toEqual(lowR8Source);
  expect(joined(old)).toContain("淡化角色性格"); expect(joined(old)).toContain("全篇共20个左右自然段");
  const text = joined(revised);
  for (const removed of ["淡化角色性格", "情节大于角色", "不刻意表现就是最好的表现", "构造能够展现该角色“萌点”的剧情", "保证角色对白含有情绪", "三段合计约600字", "全篇共20个左右自然段"]) expect(text).not.toContain(removed);
  expect(text).toContain("日常行为不必处处体现性格"); expect(text).toContain("保留人物合理的偏好、立场和情绪");
  expect(text).toContain("不设固定字数或自然段数");
  expect(() => validateLowFrame(revised)).not.toThrow();
  expect(compileLowFrame(source, scene, true, 6)).toEqual(old);
});

it.each([80, 650])("keeps a %s-word suggestion flexible and removes the competing 600-word anchor", suggestedWords => {
  const revised = compileLowFrame(lowR8Source, {...scene, proseVersion: 1, pacing: {suggestedWords}});
  const text = joined(revised);
  expect(text).toContain(`三段合计参考${suggestedWords}字`);
  expect(text).toContain("不是最低字数或上限"); expect(text).toContain("实际选择带来新问题或必要交流时可相应展开");
  expect(text).not.toContain("三段合计约600字"); expect(text).not.toContain("全篇共20个左右自然段");
  expect(joined(compileLowFrame(lowR8Source, {...scene, pacing: {suggestedWords}}))).toContain("这是GM按本轮信息量给出的软目标，不是最低字数");
});
