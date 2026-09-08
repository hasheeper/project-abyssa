import type { EmotionId } from "../../shared/domain/presentation/emotion";

/** Authored alongside the current four daily lines; never inferred from their text at runtime. */
export const MANSION_EMOTIONS: Record<string, Record<"dawn" | "day" | "dusk" | "night", EmotionId>> = {
  abyssa: {dawn:"closed", day:"confused", dusk:"smile", night:"closed"},
  alvitr: {dawn:"serious", day:"neutral", dusk:"neutral", night:"smile"},
  marietta: {dawn:"neutral", day:"displeased", dusk:"serious", night:"neutral"},
  lenore: {dawn:"displeased", day:"neutral", dusk:"closed", night:"flustered"},
  vivienne: {dawn:"neutral", day:"wry", dusk:"confident", night:"neutral"},
  eustice: {dawn:"confident", day:"flustered", dusk:"displeased", night:"neutral"},
  norma: {dawn:"wry", day:"smile", dusk:"flustered", night:"flustered"},
  elora: {dawn:"serious", day:"smile", dusk:"flustered", night:"serious"},
  kororo: {dawn:"closed", day:"displeased", dusk:"wry", night:"displeased"},
  tibby: {dawn:"smile", day:"confident", dusk:"joy", night:"wry"},
};
