import type { AirpScript, D5Catalog } from "../../../game-core/contracts";
import { TIDE_CAVE_CATALOG_DATA } from "../demo-v7/content";
import { FIRST_AIRP_ERRAND } from "../airp-v1/first-errand";
import { FIRST_AIRP_STORIES, FIRST_AIRP_PATROL_CUES } from "../airp-v1/story-data";

const scripts: Record<string, AirpScript> = Object.fromEntries(Object.values(FIRST_AIRP_STORIES).map(s => [s.id, s]));
for (const cue of Object.values(FIRST_AIRP_PATROL_CUES)) scripts[cue.id] = {
  ...FIRST_AIRP_STORIES.expired, id: cue.id,
  sections: [{ id: `${cue.id}.section`, title: FIRST_AIRP_ERRAND.title }],
  nodes: [{ id: `${cue.id}.0`, cursor: 0, sectionId: `${cue.id}.section`, kind: "beat", frames: [{ id: `${cue.id}.0`, kind: "narration", text: cue.text }] }],
};
/** A new immutable content identity; content 2–7 retain their original schemas and digests. */
export const AIRP_CATALOG_DATA: D5Catalog = {
  ...structuredClone(TIDE_CAVE_CATALOG_DATA), contentVersion: 8,
  airp: { version: 1, definition: FIRST_AIRP_ERRAND, scripts, locationId: "mansion.common-room", phases: ["dawn", "day", "dusk", "night"] },
};
