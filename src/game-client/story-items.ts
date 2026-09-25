import brokenAxlePin from "../assets/items/story/broken-axle-pin.svg";
import nail from "../assets/icons/items/hammer-nails.svg";
import coins from "../assets/icons/items/two-coins.svg";

export type StoryItem = { id: string; name: string; image: string };
const STORY_ITEMS: Record<string, StoryItem> = {
  "story.shop.barrier-nail": {id: "story.shop.barrier-nail", name: "锈蚀黑钉", image: nail},
  "story.shop.cross-coins": {id: "story.shop.cross-coins", name: "旧十字币", image: coins},
  "story.broken-axle-pin": { id: "story.broken-axle-pin", name: "断裂的车轴铁销", image: brokenAxlePin },
};

/** Local PNG/SVG registry. This is an illustration, not an inventory grant. */
export function storyItem(id: string): StoryItem {
  const item = STORY_ITEMS[id];
  if (!item) throw new Error(`Unknown story item: ${id}`);
  return item;
}
