import source from "./scenes/tide-cave.json";
import guidedSource from "./scenes/tide-cave-guided.json";
import chapterOneSource from "./scenes/tide-cave-chapter-one.json";
import { parseAvgStory } from "../../shared/domain/avg/story";
import { avgFrameLine } from "../../shared/domain/avg/playback";
import shore from "../../assets/backgrounds/tide-reef/bg.tide-reef.shore.jpg";
import cargo from "../../assets/backgrounds/tide-reef/bg.tide-reef.cargo.jpg";
import grotto from "../../assets/map/quest-backgrounds/tidecall-grotto.jpg";
import home from "../../assets/backgrounds/mansion-first-morning.webp";
import slime from "../../assets/battle/tide-reef/enemy.slime.mire.png";
import lookout from "../../assets/battle/tide-reef/enemy.outlaw.blade.png";
import crossbowman from "../../assets/battle/tide-reef/enemy.outlaw.crossbow.png";
import hauler from "../../assets/battle/tide-reef/enemy.outlaw.hauler.png";
import chief from "../../assets/battle/tide-reef/enemy.outlaw.chief.png";

/** Published saves keep their reading edition; the approved manuscript starts at content12. */
export const TIDE_STORY = parseAvgStory(source);
export const TIDE_GUIDED_STORY = parseAvgStory(guidedSource);
export const TIDE_CHAPTER_ONE_STORY = parseAvgStory(chapterOneSource);
export type TideStoryEdition = "legacy" | "guided" | "final";
const editions = {
  legacy: {story:TIDE_STORY,revision:"legacy"},
  guided: {story:TIDE_GUIDED_STORY,revision:"g4-1"},
  final: {story:TIDE_CHAPTER_ONE_STORY,revision:"chapter-one-1"}
};
export const tideStoryEdition = (contentVersion: number): TideStoryEdition => contentVersion >= 12 ? "final" : contentVersion >= 11 ? "guided" : "legacy";
export const TIDE_ROUTE = "intro.tide-cave.first";
export const tideCaveBackground = shore;
export const tideGrottoBackground = grotto;
export const tideBossBackground = cargo;
export const tideReturnBackground = home;
const storyStages = {
  shore: {background: shore, location: "雾滩·岩窟洞口"},
  grotto: {background: grotto, location: "退潮岩窟·洞内石阶"},
  cargo: {background: cargo, location: "退潮岩窟·上层货台"},
  home: {background: home, location: "守望者之崖洋馆"},
};
type StoryStage = keyof typeof storyStages;
const sectionStages: Record<string, StoryStage> = {
  "S3-1": "shore", "S3-2": "shore", "S3-3": "grotto",
  "S3-4": "cargo", "S3-5": "cargo", "S4-1": "home", "S4-2": "home",
};
// These authored lines cross a location boundary. Carry their scene forward
// through the remaining lines so cursor restoration also restores the scenery.
const finalStageChanges: Record<string, StoryStage> = {
  "S3-2.screen.2": "grotto",
  "S3-5.screen.3": "grotto",
  "S3-5.screen.3.page.1": "shore",
};
export function tideStory(id: string, edition: TideStoryEdition = "legacy") {
  const {story,revision} = editions[edition];
  const nodes = story.nodes.filter(n => n.sectionId === id && n.kind === "beat");
  if (!nodes.length) throw new Error(`Missing tutorial story ${id}`);
  const choice = story.nodes.find(n => n.sectionId === id && n.kind === "choice");
  const lines = nodes.flatMap(node => node.kind === "beat" ? node.frames.map(avgFrameLine) : []);
  let stage = sectionStages[id];
  if (!stage) throw new Error(`Missing tutorial story stage ${id}`);
  const stages = lines.map(line => {
    if (edition === "final") stage = finalStageChanges[line.id] ?? stage;
    return storyStages[stage];
  });
  return {
    title: story.sections.find(s => s.id === id)!.title,
    revision,
    isFinal: story.sections.at(-1)?.id === id,
    offstageActorId: story.player.actorId,
    ...stages[0],
    stages,
    backgrounds: [...new Set(stages.map(stage => stage.background))],
    lines,
    choice: choice?.kind === "choice" ? choice : null,
  };
}

/** Each battle takes place where its preceding AVG actually ends, not where it begins. */
export function tideBattleStage(encounter: number | string | null | undefined, edition: TideStoryEdition = "final") {
  const battle = typeof encounter === "string" ? Number(encounter.match(/^room\.tide-cave\.([1-4])$/)?.[1]) : encounter;
  return tideStory(`S3-${battle && Number.isInteger(battle) && battle >= 1 && battle <= 4 ? battle : 1}`, edition).stages.at(-1)!;
}
export const tideBattleBackground = (encounter: number | string | null | undefined, edition: TideStoryEdition = "final") => tideBattleStage(encounter, edition).background;

/**
 * Final presentation art keyed by stable gameplay definitions.
 * Heights calibrate perceived body mass after each source image's transparent bounds;
 * they are not derived from the PNG canvas dimensions. Ground anchors stay unchanged.
 */
export const tideEnemyArt: Record<string, {url: string; height: number}> = {
  "enemy.intro.tide-slime": {url: slime, height: 145},
  "enemy.intro.lookout": {url: lookout, height: 216},
  "enemy.intro.crossbowman": {url: crossbowman, height: 180},
  "enemy.intro.hauler": {url: hauler, height: 280},
  "enemy.intro.reef-hook-chief": {url: chief, height: 266},
};
