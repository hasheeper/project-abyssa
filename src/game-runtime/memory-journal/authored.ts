import { growthStories, teamMilestoneStory } from "../../content/presentation/growth-stories";
import { clockworkMemoryScript } from "../../content/presentation/clockwork-memory";
import { mariettaMemoryScript } from "../../content/presentation/marietta-memory";
import type { AuthoredLine } from "../../content/presentation/authored-story";
import { FIRST_MORNING_ENTRIES, FIRST_MORNING_STORY, morningPages } from "../../content/presentation/first-morning";
import { morningNarrative, tideNarrative, tideActStoryIds, type NarrativeMarker, type AvgFrame } from "../../content/presentation/narrative-layout";
import { manorConclusionForParty } from "../../content/presentation/manor-conclusion";
import { PROLOGUE_SHOTS, PROLOGUE_ACT_NAMES } from "../../content/presentation/prologue";
import { tideStory, tideStoryEdition } from "../../content/presentation/tide-cave";
import { actorName, type JournalBuilder, type JournalFact } from "./common";
import type { MemoryBlock, MemoryEntry, MemoryStage } from "../memory-journal-types";
import { memoryMorningBackground as morningBackground, memoryNightBackground as nightBackground } from "../../content/presentation/memory-stage-art";
import { manorScenes, manorEnemyArt } from "../../content/presentation/old-manor";
import { OPENING_MEMORY_TITLES, OPENING_MEMORY_SUMMARIES } from "../../content/presentation/opening-memory";

const assetStage = (url: string): MemoryStage => ({ background: { kind: "asset", url } });
const morningStage: MemoryStage = { ...assetStage(morningBackground), initialSlots: FIRST_MORNING_STORY.presentation.initialSlots, offstageActorId: FIRST_MORNING_STORY.player.actorId };
const morningFrames = new Map(FIRST_MORNING_STORY.nodes.flatMap(n => n.kind === "beat" ? n.frames : n.kind === "branch" ? Object.values(n.variants).flat() : []).map(frame => [frame.id, frame]));

function lineBlocks(line: AuthoredLine, item: JournalFact, choice?: string, scenery = assetStage(""), frame?: AvgFrame): MemoryBlock[] {
  const stage: MemoryStage = { ...scenery, actorId: line.characterId, expression: line.expression,
    emotion: "emotion" in line ? line.emotion : undefined, actors: "actors" in line ? line.actors?.map(a => ({ characterId: a.characterId, emotion: a.emotion })) : undefined };
  if (line.kind !== "user-choice") return [{ text: line.text, speaker: actorName(line.characterId ?? line.name, item), stage, ...(frame ? { frame } : {}) }];
  const selected = line.options.find(o => o.tone === choice);
  // Never infer a default branch from a missing choice.
  return selected ? [{ text: selected.label, kind: "choice", choice: { choiceId: line.id, optionId: selected.tone }, stage }, { text: selected.line ?? selected.action, speaker: selected.line ? actorName("kael", item) : undefined, stage: { ...stage, actorId: selected.line ? "kael" : undefined } }]
    : [{ text: line.prompt }];
}

/** Skipping unlocks the authored opening reference. Its actual start receipt
 * owns every block; no dialogue-read facts or unchosen branches are invented. */
export function skippedOpeningJournal(facts: readonly JournalFact[], out: JournalBuilder) {
  for (const item of facts) {
    if (item.fact.kind !== "progression" || item.fact.payload.type !== "game-start-selected") continue;
    if (item.fact.payload.openingFlowVersion !== 1) continue;
    const { startAt } = item.fact.payload;
    const skipReturn = ["hub", "debug-offline", "debug-shop", "airp-director", "airp-demo"].includes(startAt);
    if (!skipReturn && startAt !== "tutorial") continue;
    if (!item.catalog.data.opening || !item.catalog.data.tutorial) continue;
    const base = { kind: "authored" as const, episode: true, acquisition: "tutorial-skip" as const };
    FIRST_MORNING_ENTRIES.slice(0, item.catalog.data.opening.lastStep + 1).forEach(line => {
      if (line.kind === "decision" || line.kind === "branch") return;
      morningPages(line).forEach(page => out.add(item, { ...base, occurrence: "opening:departure", sceneId: "first-morning", lineId: page.id,
        narrative: morningNarrative(line.section),
        title: OPENING_MEMORY_TITLES.departure, summary: OPENING_MEMORY_SUMMARIES.departure.complete, iconKeywords: ["早餐"], location: "洋馆",
        blocks: lineBlocks(page, item, undefined, morningStage, morningFrames.get(page.id)) }));
    });
    if (!skipReturn) continue;
    // Both references share one receipt. Keep departure before return in the journal.
    const returned = { ...item, sequence: item.sequence + .5 };
    for (const storyId of Object.keys(item.catalog.data.tutorial.stories)) {
      const script = tideStory(storyId, tideStoryEdition(item.catalog.ref.contentVersion));
      script.lines.forEach((line, index) => out.add(returned, { ...base, occurrence: "opening:return", sceneId: `tutorial-reference:${storyId}`, lineId: line.id,
        narrative: tideNarrative(storyId, "reference", script.nodes.find(n => n.kind === "beat" && n.frames.some(f => f.id === line.id))!.id),
        title: OPENING_MEMORY_TITLES.return, summary: OPENING_MEMORY_SUMMARIES.return.complete, iconKeywords: ["毛毯"], location: "退潮岩窟 · 洋馆",
        blocks: lineBlocks(line, item, undefined, { ...assetStage(script.stages[index].background), offstageActorId: script.offstageActorId }, script.nodes.flatMap(n => n.kind === "beat" ? n.frames : []).find(f => f.id === line.id)) }));
    }
  }
}

export function tutorialJournal(facts: readonly JournalFact[], out: JournalBuilder) {
  const attempts = new Map<string, number>();
  const choices = new Map<string, "A" | "B" | "C">();
  const confirmed = new Set<string>();
  let returned = false;
  for (const item of facts) {
    if (item.fact.kind !== "journey") continue;
    const { operation: op, runRef } = item.fact.payload;
    if (op.type === "tutorial-retry") { attempts.set(runRef.id, op.attempt + 1); continue; }
    if (op.type !== "tutorial-read") continue;
    const script = tideStory(op.storyId, tideStoryEdition(item.catalog.ref.contentVersion));
    const attempt = attempts.get(runRef.id) ?? 1, sceneId = `${runRef.id}:${attempt}:${op.storyId}`;
    // The ADV keeps paragraph navigation locally and acknowledges the whole act
    // with one step-0 command. It is not a per-paragraph backend cursor.
    if (item.catalog.data.tutorial?.stories[op.storyId]?.lastStep !== 0 || op.step !== 0) { out.issue("退潮岩窟"); continue; }
    returned ||= op.storyId.startsWith("S4-") && script.isFinal;
    const base = { kind: "authored" as const, occurrence: "opening:return", episode: true, sceneId, title: OPENING_MEMORY_TITLES.return,
      summary: OPENING_MEMORY_SUMMARIES.return[returned ? "complete" : "ongoing"], iconKeywords: ["毛毯"], location: "退潮岩窟 · 洋馆" };
    confirmed.add(`${runRef.id}:${attempt}:${op.storyId}`);
    const complete = tideActStoryIds(op.storyId).filter(id => item.catalog.data.tutorial?.stories[id]).every(id => confirmed.has(`${runRef.id}:${attempt}:${id}`));
    script.lines.forEach((line, index) => {
      const node = script.nodes.find(n => n.kind === "beat" && n.frames.some(f => f.id === line.id))!;
      out.add(item, { ...base, lineId: line.id, narrative: { ...tideNarrative(op.storyId, `${runRef.id}:${attempt}`, node.id), complete },
        blocks: lineBlocks(line, item, undefined, { ...assetStage(script.stages[index].background), offstageActorId: script.offstageActorId }, node.kind === "beat" ? node.frames.find(f => f.id === line.id) : undefined) });
    });
    const choiceKey = `${runRef.id}:${op.storyId}`;
    if (op.choice !== "continue") choices.set(choiceKey, op.choice);
    const choice = choices.get(choiceKey);
    if (item.catalog.data.tutorial?.stories[op.storyId]?.choiceStep === op.step && script.choice && choice) {
      const selected = script.choice.options.find(o => o.id === choice);
      if (selected) out.add(item, { ...base, lineId: script.choice.id,
        narrative: tideNarrative(op.storyId, `${runRef.id}:${attempt}`, script.nodes.at(-1)!.id),
        blocks: [{ text: selected.label, kind: "choice", choice: { choiceId: script.choice.id, optionId: choice }, stage: assetStage(script.stages.at(-1)!.background) }] });
      else out.issue("退潮岩窟");
    }
  }
}
type MemoryNode = "present-intro" | "history-opening" | "teaching" | "history-complete";
const previousNode = { "history-opening": "present-intro", teaching: "history-opening", battle: "teaching", "return-pending": "history-complete" } as const;
const nodeNames = { "present-intro": "当下的谈话", "history-opening": "旧日回忆", teaching: "再度交锋", "history-complete": "回忆之后", "return-pending": "回到洋馆" };

export function authoredJournal(facts: readonly JournalFact[], out: JournalBuilder) {
  const sessions = new Map<string, { eventId: string; cursor: number }>();
  const memories = new Map<string, string>();
  const memoryCursors = new Map<string, number>();
  const morningChoices = new Map<string, "A" | "B" | "C">();
  const scripts = (template: string | undefined) => template === "profile.memory.clockwork.v1" ? clockworkMemoryScript : template === "profile.memory.marietta.v1" ? mariettaMemoryScript : null;
  const addLines = (item: JournalFact, occurrence: string, sceneId: string, title: string, lines: readonly AuthoredLine[], choice?: string, location = "洋馆", stage = assetStage(""), episode = false, presentation: Pick<MemoryEntry, "summary" | "iconKeywords"> = {}, narrative?: NarrativeMarker) => {
    lines.forEach(line => out.add(item, { kind: "authored", occurrence, sceneId, lineId: line.id, title, ...presentation, location, episode, narrative, blocks: lineBlocks(line, item, choice, stage, sceneId === "first-morning" ? morningFrames.get(line.id) : undefined) }));
  };
  for (const item of facts) {
    const { fact, catalog } = item;
    if (fact.kind !== "progression") continue;
    const e = fact.payload;
    if (e.type === "story-started") {
      if (!sessions.has(e.sessionId)) sessions.set(e.sessionId, { eventId: e.eventId, cursor: 0 });
    } else if (e.type === "story-advanced" || e.type === "story-completed") {
      const session = sessions.get(e.sessionId);
      if (!session) { out.issue("固定剧情", "部分旧剧情缺少场次来源，暂未收录。"); continue; }
      const story = session.eventId === teamMilestoneStory.eventId ? teamMilestoneStory : growthStories[session.eventId];
      const memory = session.eventId === "story.marietta.return" ? scripts(catalog.data.progression?.chapter.templateId) : null;
      const lines = story?.lines ?? memory?.["return-pending"];
      if (!lines) { out.issue("固定剧情"); continue; }
      // A skip jumps the cursor without acknowledging the intervening prose.
      if (e.type === "story-advanced" && (e.choice === "skip" || e.choice === "later")) {
        if (e.choice === "skip") session.cursor = lines.length - 1;
        continue;
      }
      const step = e.type === "story-completed" ? lines.length - 1 : e.step;
      if (step !== session.cursor || !lines[step]) { out.issue("固定剧情", "部分剧情的阅读记录不连续，未补出缺失段落。"); continue; }
      addLines(item, `story:${e.sessionId}`, e.sessionId, story?.title ?? nodeNames["return-pending"], [lines[step]], e.type === "story-advanced" ? e.choice : undefined, "洋馆", assetStage(memory ? nightBackground : ""));
      session.cursor = step + 1;
    } else if (e.type === "memory-started") memories.set(e.runId, e.templateId);
    else if (e.type === "memory-read" || e.type === "memory-advanced") {
      const node: MemoryNode = e.type === "memory-read" ? e.node : previousNode[e.node];
      const source = scripts(memories.get(e.runRef.id));
      if (!source) { out.issue("回忆章节"); continue; }
      const sceneId = `${e.runRef.id}:${e.runRef.attempt}:${node}`, cursor = memoryCursors.get(sceneId) ?? 0;
      const step = e.type === "memory-read" ? e.step : source[node].length - 1;
      // Advancing a chapter directly is not proof of reading its previous pages.
      if (step !== cursor || !source[node][step]) { out.issue("回忆章节", "部分章节没有完整阅读记录，未将跳过的内容补成正文。"); continue; }
      const historical = node !== "present-intro", clockwork = memories.get(e.runRef.id) === "profile.memory.clockwork.v1";
      addLines(item, `memory:${sceneId}`, sceneId, nodeNames[node], [source[node][step]], e.type === "memory-read" ? e.choice : undefined, "洋馆",
        { ...assetStage(historical ? manorScenes["old-manor.service-corridor"] : nightBackground), ...(historical && !clockwork ? { portraits: { marietta: manorEnemyArt["memory.marietta"].url } } : {}) });
      memoryCursors.set(sceneId, cursor + 1);
    } else if (e.type === "opening-advanced") {
      const line = FIRST_MORNING_ENTRIES[e.step];
      if (!line || e.step > (catalog.data.opening?.lastStep ?? -1)) { out.issue("初晨"); continue; }
      const occurrence = "opening:departure", title = OPENING_MEMORY_TITLES.departure;
      const narrative = morningNarrative(line.section);
      const next = FIRST_MORNING_ENTRIES[e.step + 1];
      narrative.complete = !next || morningNarrative(next.section).actId !== narrative.actId;
      const summary = OPENING_MEMORY_SUMMARIES.departure[e.step >= FIRST_MORNING_ENTRIES.length - 2 ? "complete" : "ongoing"];
      if (line.kind === "decision") {
        if (e.choice === "continue" || !line.options[e.choice]) { out.issue("初晨"); continue; }
        morningChoices.set(line.id, e.choice);
        out.add(item, { kind: "authored", occurrence, episode: true, sceneId: "first-morning", lineId: line.id, title, summary, narrative, iconKeywords: ["早餐"], location: "洋馆", blocks: [{ kind: "choice", text: line.options[e.choice]!, choice: { choiceId: line.id, optionId: e.choice }, stage: morningStage }] });
      } else {
        const selected = line.kind === "branch" ? morningChoices.get(line.choiceId) : null;
        const beat = line.kind === "branch" ? selected && line.variants[selected] : line;
        if (!beat) { out.issue("初晨"); continue; }
        addLines(item, occurrence, "first-morning", title, morningPages(beat), undefined, "洋馆", morningStage, true, { summary, iconKeywords: ["早餐"] }, narrative);
      }
    } else if (e.type === "manor-story" && e.choice === "continue") {
      const terminal = facts.find(i => i.fact.kind === "progression" && i.fact.payload.type === "expedition-settled" && i.fact.payload.terminal.id === e.terminalId)?.fact;
      if (terminal?.kind !== "progression" || terminal.payload.type !== "expedition-settled") { out.issue("庄园归来"); continue; }
      const lines = manorConclusionForParty(terminal.payload.finalRun.run.party.map(p => p.id))[e.step];
      if (lines) addLines(item, `manor:${e.terminalId}`, e.terminalId, "家宴之后", lines);
      else out.issue("庄园归来");
    } else if (e.type === "prologue-advanced" || e.type === "prologue-completed" && e.choice === "continue") {
      const shot = PROLOGUE_SHOTS.find(s => s.id === e.shotId);
      if (!shot) { out.issue("序章"); continue; }
      out.add(item, { kind: "authored", occurrence: `prologue:${shot.act}`, sceneId: shot.id, lineId: shot.id, title: `序章 · ${PROLOGUE_ACT_NAMES[shot.act - 1]}`, blocks: shot.beats.map(b => ({ text: b.text, speaker: actorName(b.speaker, item) })) });
    }
  }
}
