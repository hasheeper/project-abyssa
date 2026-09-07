import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { AuthoredLine } from "../../../content/presentation/marietta-memory";
import { manorJourneyDialogue, type ManorScene } from "../../../content/presentation/manor-journey-dialogue";

export type JourneyStory = {id: string; title: string; lines: AuthoredLine[]};
/** Choose a script from committed state; never assign an absent character's lines to another actor. */
export function manorJourneyStory(v: DemoJourneyView): JourneyStory | null {
  const node = v.expedition?.node, result = v.lastEvent;
  if (!v.expedition || !v.roomId || v.battle?.encounter.memory) return null;
  let scene: ManorScene, title: string;
  if (node === "event" && v.event) {
    scene = `${v.event.kind}-intro`;
    title = v.event.name;
  } else if (node === "room-complete" && result && result.method !== "skip") {
    scene = result.method === "read" ? result.eventId === "event.old-manor.seats" ? "seats-read" : "register-read" : result.method === "failed" ? "relic-lost" : "relic-kept";
    title = result.method === "read" ? "庄园记录" : "整理遗物";
  } else if (node === "exit") {scene = "exit"; title = "门扉之后";}
  else return null;
  const id = `${v.head.saveId}:${v.head.epoch}:${v.expedition.run.id}:${v.roomId}:${node}:${result?.method ?? "intro"}`;
  const rows = manorJourneyDialogue(scene,v.party.map(m=>m.id),result?.actorId ?? null,v.fullManor);
  return {id, title, lines: rows.map((row,i) => ({...row,id:`${id}:${i}`}))};
}
