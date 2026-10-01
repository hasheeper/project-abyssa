import { storyIdentities } from "../../content/characters/story-identities";
import type { MemoryEntry } from "./memory-types";

export function MemoryParticipants({ entry }: { entry: MemoryEntry }) {
  if (!entry.actors.length) return null;
  return <ul className="memory-reader__participants" aria-label="参与者">
    {entry.actors.map(name => {
      // Recorded speakers keep their own names; stage IDs resolve their existing art.
      const actorId = entry.blocks.find(block => block.speaker === name && block.stage?.actorId)?.stage?.actorId;
      const actor = storyIdentities.find(identity => identity.id === actorId)
        ?? storyIdentities.find(identity => [identity.id, identity.name, identity.selectorLabel].includes(name));
      return <li className="memory-reader__participant" key={name}>
        <span className="memory-reader__avatar" role="img" aria-label={name} tabIndex={0}>
          {actor?.thumbnailUrl ? <img src={actor.thumbnailUrl} alt="" draggable={false} /> : name.slice(0, 1)}
        </span>
        <span className="memory-reader__participant-name" aria-hidden="true">{name}</span>
      </li>;
    })}
  </ul>;
}
