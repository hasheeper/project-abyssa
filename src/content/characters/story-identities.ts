import { archiveIdentities } from "./identities";
import type { CharacterArchiveProfile } from "../../shared/domain/characters/archive";
import tibbyPortrait from "../../assets/characters/portraits/tibby-shop.png";

type StoryIdentity = Pick<CharacterArchiveProfile, "id" | "name" | "secondaryName" | "selectorLabel" | "portraitUrl" | "thumbnailUrl">;

/** NPCs may speak on the AVG stage without becoming a playable/archive member. */
export const storyIdentities: readonly StoryIdentity[] = [
  ...archiveIdentities,
  {id: "tibby", name: "缇比·奥雷利亚", secondaryName: "TIBBY AURELIA", selectorLabel: "缇比", portraitUrl: tibbyPortrait, thumbnailUrl: tibbyPortrait},
];
