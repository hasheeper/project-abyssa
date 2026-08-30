export type CharacterArchiveAffiliationTone =
  | "demon-lord"
  | "demon-cadre"
  | "hero-party";

export type CharacterArchiveSelectorVariant =
  | "dark"
  | "gray"
  | "deep"
  | "teal"
  | "teal-outline"
  | "light";

export interface CharacterArchiveOutfit {
  id: string;
  label: string;
  displayLabel: string;
  appearanceLabel?: string;
  portraitUrl: string;
  portraitAlt?: string;
}

export interface CharacterArchiveField {
  label: string;
  secondaryLabel?: string;
  value: string;
}

export interface CharacterArchiveStat {
  label: string;
  secondaryLabel?: string;
  value: string;
  accent?: boolean;
}

export interface CharacterArchiveTrait {
  name: string;
  summary?: string;
  description?: string;
  iconUrl?: string;
}

export interface CharacterArchiveStatus {
  title: string;
  titleRootIndex?: number;
  subtitle?: string;
  affiliation?: {
    label: string;
    secondaryLabel?: string;
    tone?: CharacterArchiveAffiliationTone;
  };
  state?: string;
  fields?: CharacterArchiveField[];
  stats?: CharacterArchiveStat[];
  traits?: CharacterArchiveTrait[];
  parametersTitle?: string;
  archiveTitle?: string;
  traitsTitle?: string;
  recordTitle?: string;
  record?: string;
  quote?: string;
}

/** Serializable content contract consumed by the character archive UI. */
export interface CharacterArchiveProfile {
  id: string;
  number: string;
  name: string;
  secondaryName?: string;
  selectorLabel?: string;
  selectorVariant?: CharacterArchiveSelectorVariant;
  disabled?: boolean;
  portraitUrl?: string;
  portraitAlt?: string;
  appearanceLabel?: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  outfits?: CharacterArchiveOutfit[];
  status: CharacterArchiveStatus;
}
