import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FirstMorningPlayer, morningMessages, morningPlayerText } from "./FirstMorningStory";
import { FIRST_MORNING_ENTRIES, firstMorningAssetsLines, morningTranscript } from "../content/presentation/first-morning";
import { FIRST_MORNING_CATALOG_DATA } from "../content/gameplay/demo-v5/content";
import { MORNING_DEPARTURE_CATALOG_DATA } from "../content/gameplay/demo-v6/content";
import { deriveRpStage } from "../shared/ui/patterns/rp-stage";
import { storyActors, storyAssets } from "./story-actors";
import { storyItem } from "./story-items";
import { existsSync } from "node:fs";
afterEach(()=>{cleanup();vi.useRealTimers();delete (HTMLElement.prototype as Partial<HTMLElement>).animate;delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;});

it("matches the saved cursors and all 81 branch combinations without apron leakage",()=> {
  const spec=FIRST_MORNING_CATALOG_DATA.opening!;
  expect(FIRST_MORNING_ENTRIES.length-1).toBe(MORNING_DEPARTURE_CATALOG_DATA.opening!.lastStep);
  expect(FIRST_MORNING_ENTRIES.flatMap((e,i)=>e.kind==="decision"?[i]:[])).toEqual(MORNING_DEPARTURE_CATALOG_DATA.opening!.choiceSteps);
  for(const a of ["A","B","C"] as const) for(const b of ["A","B","C"] as const) for(const c of ["A","B","C"] as const) for(const d of ["A","B","C"] as const) {
    const choices=[a,b,c,d].map((choice,i)=>({step:spec.choiceSteps[i],choice}));
    const transcript=morningTranscript(66,choices);
    expect(transcript).toHaveLength(67);expect(new Set(transcript.map(b=>b.id)).size).toBe(67);
    const last=transcript.slice(59).map(b=>"text" in b?b.text:"").join("");
    expect(last.includes("围裙")).toBe(d==="C");
    const text=morningMessages(66,choices).map(m=>"text" in m?m.text:"").join("");
    expect(text).not.toMatch(/凯尔|\{\{user\}\}|你大人|你先生/);
    for(const departure of ["A","B"] as const) {
      const whole=morningTranscript(119,[...choices,{step:96,choice:departure}]);
      expect(whole).toHaveLength(120);
      expect(new Set(whole.map(b=>b.id)).size).toBe(120);
      const response=whole.slice(97,101).map(b=>"text" in b?b.text:"").join("");
      expect(response.includes("要是弄坏了")).toBe(departure==="A");
      expect(response.includes("日落之前")).toBe(departure==="B");
      expect(whole.at(-1)).toMatchObject({effect:"handoff",text:"第一章：雾滩·退潮岩窟"});
    }
  }
  for(const asset of storyAssets(firstMorningAssetsLines,"/src/assets/backgrounds/mansion-first-morning.webp")) expect(existsSync(asset.slice(1)),asset).toBe(true);
  for(const actor of storyActors(firstMorningAssetsLines)) expect(actor.avatar,actor.id).toMatch(/\/src\/assets\/characters\/(avatars|portraits)\//);
});
it("keeps the player's voice offstage and preserves the source dialogue exception",()=> {
  const m=morningMessages(13,[{step:6,choice:"B"}]);
  expect(deriveRpStage(m,{left:"abyssa"}).slots).toEqual({left:"abyssa",right:"marietta"});
  expect(m.find(b=>b.kind==="say" && b.actorId==="kael")).toMatchObject({offstage:true,text:"不想吃的话，我就收走了。"});
  expect(morningPlayerText("早安，{{user}}大人。")).toBe("早安，大人。");
  expect(morningPlayerText("早安，{{user}}大人。","测试名")).toBe("早安，测试名大人。");
  expect(morningPlayerText("……哈啊、哈啊……呼。{{user}}，水。")).toBe("……哈啊、哈啊……呼。水。");
});

it("keeps breakfast and the departure scene under one title without remounting the stage",()=>{
  const props={choices:[6,24,42,58].map(step=>({step,choice:"A" as const})),onAdvance:vi.fn(),onExit:()=>{}};
  const view=render(<FirstMorningPlayer {...props} step={66}/>);
  const stage=view.container.querySelector(".rp-adv");
  expect(view.container.querySelector(".rp-app__pager")).toHaveTextContent("洋馆的第一个清晨");
  view.rerender(<FirstMorningPlayer {...props} step={67}/>);
  expect(view.container.querySelector(".rp-adv")).toBe(stage);
  expect(view.container.querySelector(".rp-app__pager")).toHaveTextContent("洋馆的第一个清晨");
  expect(view.container.querySelector(".first-morning__handoff")).toBeNull();
});
it("offers exactly two departure choices in AVG and RP and keeps the chosen response",async()=> {
  vi.useFakeTimers();const advance=vi.fn();
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel:vi.fn(),finished:Promise.resolve()}))});
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:vi.fn()});
  const choices=([6,24,42,58]).map(step=>({step,choice:"A" as const}));
  const view=render(<FirstMorningPlayer step={96} choices={choices} onAdvance={advance} onExit={()=>{}}/>);
  expect(view.container.querySelectorAll(".first-morning__choice")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"切换为 RP 舞台"}));
  await act(async()=>vi.advanceTimersByTime(600));
  expect(view.container.querySelectorAll(".first-morning__choice")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button",{name:"直接越过红线，按住她的发顶"}));
  expect(advance).toHaveBeenCalledWith("B");
  view.rerender(<FirstMorningPlayer step={100} choices={[...choices,{step:96,choice:"B"}]} onAdvance={advance} onExit={()=>{}}/>);
  expect(view.container.textContent).toContain("……日落之前。……凉了，我会生气的。");
  expect(view.container.textContent).not.toContain("……要是弄坏了，就修不好了。");
  view.rerender(<FirstMorningPlayer step={119} choices={[...choices,{step:96,choice:"B"}]} onAdvance={advance} onExit={()=>{}}/>);
  expect(screen.getByRole("region",{name:"第一章：雾滩·退潮岩窟"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"结束本场"})).toBeTruthy();
});
it("starts in AVG and switches the same decision to RP without advancing or selecting anything",async()=> {
  vi.useFakeTimers();const advance=vi.fn();
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel:vi.fn(),finished:Promise.resolve()}))});
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:vi.fn()});
  const view=render(<FirstMorningPlayer step={6} choices={[]} onAdvance={advance} onExit={()=>{}}/>);
  expect(screen.getByLabelText("AVG 对话")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"切换为 RP 舞台"}));
  await act(async()=>vi.advanceTimersByTime(600));
  expect(screen.getByLabelText("RP 消息流")).toBeTruthy();
  expect(view.container.querySelectorAll(".abyssa-rp__avatar-photo img").length).toBeGreaterThan(0);
  expect(view.container.querySelector(".rp-adv")).toBeNull();
  expect(advance).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:/直接把盛着香肠/}));
  expect(advance).toHaveBeenCalledWith("B");
  view.rerender(<FirstMorningPlayer step={9} choices={[{step:6,choice:"B"}]} onAdvance={advance} onExit={()=>{}}/>);
  expect(screen.getByLabelText("RP 消息流").textContent).toContain("……等等。我吃，把盘子推回来。");
  expect(view.container.textContent).not.toContain("来，张嘴。");
  fireEvent.click(screen.getByRole("button",{name:"切换为 AVG 舞台"}));
  await act(async()=>vi.advanceTimersByTime(600));
  expect(view.container.querySelector(".abyssa-rp")).toBeNull();
  expect(view.container.querySelector('[data-character="abyssa"]')?.getAttribute("data-expression")).toBe("f");
});

it("keeps silent blocking out of RP history and does not expose an unread reaction page",()=> {
  const choices=[6,24,42].map(step=>({step,choice:"A" as const}));
  const first=morningMessages(57,choices,0);
  expect(first.some(m=>m.kind==="say" && m.actorId==="eustice" && m.text==="…………！")).toBe(true);
  expect(first.some(m=>m.kind==="say" && m.text==="噫……！")).toBe(false);
  expect(morningMessages(57,choices,1).at(-1)).toMatchObject({kind:"say",actorId:"elora",text:"噫……！"});
  const all=morningMessages(119,[...choices,{step:58,choice:"A"},{step:96,choice:"B"}]);
  expect(all.filter(m=>m.kind==="narration" && !m.text)).toEqual([]);
  const prose=all.filter(m=>m.kind!=="stage").map(m=>"text" in m?m.text:"").join("");
  expect(prose).not.toMatch(/老兵临阵的熟练|将领的冷峻|肩膀猛地一缩|被抽干了所有结合力|像提一只脱力的大猫/);
  for(const detail of ["柑橘的冷香","防蛀草药味","黄铜挂钩","海腥黑泥","微温"])expect(prose).toContain(detail);
  const stage=morningMessages(88,[...choices,{step:58,choice:"A"}]);
  expect(Object.values(deriveRpStage(stage).slots)).toContain("abyssa");
});

it("plays the two S1 reactions as separate clicks without changing the saved cursor",async()=> {
  vi.useFakeTimers();const advance=vi.fn();
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel:vi.fn(),finished:Promise.resolve()}))});
  const view=render(<FirstMorningPlayer step={57} choices={[6,24,42].map(step=>({step,choice:"A"}))} onAdvance={advance} onExit={()=>{}}/>);
  await act(async()=>vi.advanceTimersByTime(1000));
  expect(view.container.querySelector(".rp-adv__dialogue")?.textContent).toContain("…………！");
  fireEvent.click(screen.getByRole("button",{name:"下一句"}));
  await act(async()=>vi.advanceTimersByTime(1000));
  expect(advance).not.toHaveBeenCalled();
  expect(view.container.querySelector(".rp-adv__dialogue")?.textContent).toContain("噫……！");
  fireEvent.click(screen.getByRole("button",{name:"下一句"}));
  expect(advance).toHaveBeenCalledExactlyOnceWith("continue");
});

it("advances a silent beat once, pauses in LOG, and allows manual retry after a failed save",async()=> {
  vi.useFakeTimers();const advance=vi.fn();
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel:vi.fn(),finished:Promise.resolve()}))});
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:vi.fn()});
  const props={step:68,choices:[6,24,42,58].map(step=>({step,choice:"A" as const})),onAdvance:advance,onExit:()=>{}};
  const view=render(<FirstMorningPlayer {...props}/>);
  expect(view.container.querySelector(".rp-adv__dialogue")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"回看已读对白"}));
  await act(async()=>vi.advanceTimersByTime(5000));
  expect(advance).not.toHaveBeenCalled();
  expect(view.container.querySelector('.abyssa-rp__message[data-kind="stage"]')).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"关闭回看"}));
  await act(async()=>vi.advanceTimersByTime(251));
  expect(advance).toHaveBeenCalledTimes(1);
  view.rerender(<FirstMorningPlayer {...props} error="保存失败"/>);
  await act(async()=>vi.advanceTimersByTime(5000));
  expect(advance).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button",{name:"继续"}));
  expect(advance).toHaveBeenCalledTimes(2);
});

it("shows the clue in a shared square frame in AVG and RP, and dismisses it with the next page",async()=> {
  vi.useFakeTimers();
  Object.defineProperty(HTMLElement.prototype,"animate",{configurable:true,value:vi.fn(()=>({cancel:vi.fn(),finished:Promise.resolve()}))});
  Object.defineProperty(HTMLElement.prototype,"scrollTo",{configurable:true,value:vi.fn()});
  const props={step:71,choices:[6,24,42,58].map(step=>({step,choice:"A" as const})),onAdvance:vi.fn(),onExit:()=>{}};
  const view=render(<FirstMorningPlayer {...props}/>);
  const item=screen.getByRole("dialog",{name:"道具：断裂的车轴铁销"});
  expect(item).toHaveClass("abyssa-frame","story-item-display");
  expect(screen.getByAltText("断裂的车轴铁销")).toHaveAttribute("src",storyItem("story.broken-axle-pin").image);
  expect(view.container.querySelector(".morning-prop")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"切换为 RP 舞台"}));
  await act(async()=>vi.advanceTimersByTime(600));
  expect(screen.getByRole("dialog",{name:"道具：断裂的车轴铁销"})).toBe(item);
  fireEvent.click(screen.getByRole("button",{name:"回看已读对白"}));
  expect(screen.queryByRole("dialog",{name:"道具：断裂的车轴铁销"})).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"关闭回看"}));
  expect(screen.getByRole("dialog",{name:"道具：断裂的车轴铁销"})).toBeTruthy();
  view.rerender(<FirstMorningPlayer {...props} step={72}/>);
  await act(async()=>vi.advanceTimersByTime(200));
  expect(view.container.querySelector(".story-item-display")).toBeNull();
  expect(props.onAdvance).not.toHaveBeenCalled();
});
