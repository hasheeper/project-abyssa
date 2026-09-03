import abyssaAvatar from "../../assets/characters/avatars/abyssa.png";
import alvitrAvatar from "../../assets/characters/avatars/alvitr.png";
import eloraAvatar from "../../assets/characters/avatars/elora.png";
import eusticeAvatar from "../../assets/characters/avatars/eustice.png";
import kororoAvatar from "../../assets/characters/avatars/kororo.png";
import lenoreAvatar from "../../assets/characters/avatars/lenore.png";
import mariettaAvatar from "../../assets/characters/avatars/marietta.png";
import normaAvatar from "../../assets/characters/avatars/norma.png";
import vivienneAvatar from "../../assets/characters/avatars/vivienne.png";
import type { MansionCharacter } from "./data";
import { roomPreviewImageStyle } from "./mansion-geometry";
import type { SceneRegion } from "./mansion-geometry";

const MANSION_AVATARS: Record<string, string> = {
  abyssa: abyssaAvatar,
  alvitr: alvitrAvatar,
  elora: eloraAvatar,
  eustice: eusticeAvatar,
  kororo: kororoAvatar,
  lenore: lenoreAvatar,
  marietta: mariettaAvatar,
  norma: normaAvatar,
  vivienne: vivienneAvatar
};

export function getMansionAvatar(characterId: string) {
  return MANSION_AVATARS[characterId];
}

export function ResidentAvatar({ character }: { character: MansionCharacter }) {
  const avatar = getMansionAvatar(character.id);
  return (
    <span className="mansion-room-card__resident-avatar" role="listitem" title={character.name}>
      {avatar ? (
        <img src={avatar} alt={character.name} draggable={false} />
      ) : (
        <span
          className="mansion-room-card__resident-placeholder"
          role="img"
          aria-label={`${character.name}头像待补`}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="16" cy="11" r="6" />
            <path d="M5 29c.8-7.2 4.5-11 11-11s10.2 3.8 11 11" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function MansionRoomPreview({
  region,
  label
}: {
  region: SceneRegion;
  label: string;
}) {
  return (
    <div className="mansion-room-card__preview" role="img" aria-label={`${label}房间预览`}>
      <img
        src={`${import.meta.env.BASE_URL}mansion-map/composite-reference.png`}
        alt=""
        draggable={false}
        style={roomPreviewImageStyle(region)}
      />
      <span aria-hidden="true">ROOM VIEW</span>
    </div>
  );
}
