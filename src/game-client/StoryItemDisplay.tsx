import { useEffect, useState } from "react";
import { RpgFrame } from "../shared/ui/primitives/RpgFrame";
import type { StoryItem } from "./story-items";
import "./story-item-display.css";

/** A small, non-modal story illustration. Reading controls retain focus and dismiss it on the next page. */
export function StoryItemDisplay({item}: {item?: StoryItem}) {
  const [previous, setPrevious] = useState(item);
  useEffect(() => {
    if (item) { setPrevious(item); return; }
    const timer = setTimeout(() => setPrevious(undefined), 180);
    return () => clearTimeout(timer);
  }, [item]);
  const shown = item ?? previous;
  if (!shown) return null;
  return <RpgFrame className="story-item-display" variant="dark" padding="none" role="dialog" aria-modal="false"
    aria-label={`道具：${shown.name}`} aria-hidden={!item || undefined} data-visible={!!item} data-item-id={shown.id}>
    <figure>
      <img src={shown.image} alt={shown.name} width={152} height={152} draggable={false}/>
      <figcaption>{shown.name}</figcaption>
    </figure>
  </RpgFrame>;
}
