import brokenAxlePin from "../assets/items/story/broken-axle-pin.svg";

export type StoryItem = { id: string; name: string; image: string };
const STORY_ITEMS: Record<string, StoryItem> = {
  "story.broken-axle-pin": { id: "story.broken-axle-pin", name: "断裂的车轴铁销", image: brokenAxlePin },
};

/** Local PNG/SVG registry. This is an illustration, not an inventory grant. */
export function storyItem(id: string): StoryItem {
  const item = STORY_ITEMS[id];
  if (!item) throw new Error(`Unknown story item: ${id}`);
  return item;
}
