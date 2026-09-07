import { growthStories, teamMilestoneStory } from "../content/presentation/growth-stories";
import type { CharacterHistoryEntry } from "../game-application";
import type { CharacterChronicle, ChronicleEntry } from "../shared/domain/characters/chronicle";

/** The character journal keeps milestones; combat telemetry stays in the source history. */
export function presentCharacterChronicle(characterId: string, history: readonly CharacterHistoryEntry[]): CharacterChronicle {
  const seen = new Set<string>();
  const blocks: CharacterChronicle["blocks"] = [];
  for (const event of history) {
    const story = event.eventId === teamMilestoneStory.eventId
      ? teamMilestoneStory : event.eventId ? growthStories[event.eventId] : undefined;
    let content: Pick<ChronicleEntry, "title" | "body" | "categories" | "marker" | "tone">;
    let key: string;
    if (story) {
      key = story.eventId;
      content = {
        title: story.title, body: story.chronicleText, categories: ["bond"],
        marker: event.kind === "team-milestone" ? "milestone" : "node",
        tone: event.kind === "team-milestone" ? "accent" : "default",
      };
    } else if (event.kind === "manor-takeover-completed") {
      key = event.kind;
      content = {
        title: "家宴落幕", body: "千金身上的红线终于断开，玛丽埃塔接管了旧庄园。",
        categories: ["battle"], marker: "milestone", tone: "accent",
      };
    } else if (event.kind === "memory-completed") {
      key = `${event.kind}:${event.memoryTemplate ?? "marietta"}`;
      const clockwork = event.memoryTemplate === "clockwork";
      content = {
        title: clockwork ? "钟声停歇" : "越过红线",
        body: clockwork ? "勇者小队击败刻仪兽，旧日钟廊的钟声终于停了下来。" : "勇者小队突破了防线，玛丽埃塔收线止战。",
        categories: ["battle"], marker: "hollow", tone: "accent",
      };
    } else if (event.kind === "marietta-sortie-unlocked") {
      key = event.kind;
      content = {
        title: "名单上的一行", body: "谈起旧日交锋后，玛丽埃塔决定与大家一同出征。",
        categories: ["bond"], marker: "milestone", tone: "accent",
      };
    } else continue;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({
      kind: "entry", id: event.id,
      stamp: event.origin === "memory" ? "回忆" : `第 ${event.worldTime.day} 天`,
      ...content,
    });
  }
  return { characterId, blocks, placeholderNote: "尚无重要记事。" };
}
