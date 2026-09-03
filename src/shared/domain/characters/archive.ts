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

export interface CharacterArchiveBond {
  level: number;
  progress?: number;
  progressMax?: number;
  slots?: number;
}

export interface CharacterArchiveStatusChip {
  label: string;
  detail?: string;
  tone?: "neutral" | "danger";
  icon?: "wound" | "book";
  iconUrl?: string;
}

export interface CharacterArchivePact {
  name: string;
  iconUrl?: string;
  currentStage?: 1 | 2 | 3;
  trigger: string;
  currentTerm: string;
  nextLevel?: number;
  nextLabel?: string;
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
  bond?: CharacterArchiveBond;
  statusChips?: CharacterArchiveStatusChip[];
  pact?: CharacterArchivePact;
  fields?: CharacterArchiveField[];
  stats?: CharacterArchiveStat[];
  traits?: CharacterArchiveTrait[];
  parametersTitle?: string;
  archiveTitle?: string;
  traitsTitle?: string;
  recordTitle?: string;
  record?: string;
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
