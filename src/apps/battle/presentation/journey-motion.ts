/** Presentation only: committed room changes never depend on these timings. */
export const JOURNEY_MOTION_MS = {
  walking: 680,
  arriving: 280,
  encounter: 1200,
  flash: 240,
  revealing: 280,
} as const;

// Loading is resource-gated, not another fixed encounter timeout.
export const ROOM_LOADING_MIN_MS = 180;
export const ROOM_LOADING_NOTICE_MS = 300;
export type JourneyMotion = keyof typeof JOURNEY_MOTION_MS | "loading" | "loaded";
