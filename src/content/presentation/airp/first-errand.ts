import { FIRST_AIRP_STORIES as authored } from "../../gameplay/airp-v1/story-data";
import { parseAvgStory, type AvgStory } from "../../../shared/domain/avg/story";

/** Gameplay owns frozen authored data; presentation validates the same bodies as AVG. */
export const FIRST_AIRP_STORIES = Object.fromEntries(Object.entries(authored).map(([key, value]) => [key, parseAvgStory(value)])) as Record<keyof typeof authored, AvgStory>;
export { FIRST_AIRP_PATROL_CUES, FIRST_AIRP_OPTION_STANCES, FIRST_AIRP_PROFILE } from "../../gameplay/airp-v1/story-data";
