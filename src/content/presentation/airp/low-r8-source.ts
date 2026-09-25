import { householdDirectorDocuments } from "./household-documents";
import preset from "../../../../docs/baselines/airp-style-r8/preset.json?raw";
import { activatedDirectorDocuments } from "./director-documents";
import { EMOTION_LABELS } from "../../../shared/domain/presentation/emotion";
import { CHARACTER_EMOTION_PROFILES } from "../character-emotions";

/** Reuse the frozen artifact verbatim; no second hand-edited preset copy. Not installed in default runtime. */
export const lowR8Source = {
  version: 1 as const, preset, sources: activatedDirectorDocuments.filter(s => ["world", "character", "player"].includes(s.kind)),
  common: EMOTION_LABELS, specials: Object.fromEntries(Object.entries(CHARACTER_EMOTION_PROFILES).map(([id, p]) => [id, Object.keys(p.specials ?? {})])),
};

export const householdLowR8Source = {...lowR8Source, sources: householdDirectorDocuments.filter(s => ["world", "character", "player"].includes(s.kind))};
