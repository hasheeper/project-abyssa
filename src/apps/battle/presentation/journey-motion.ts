/** Presentation only: committed room changes never depend on these timings. */
export const JOURNEY_MOTION_MS = {
  walking: 680,
  arriving: 280,
  encounter: 1200,
  flash: 240,
  revealing: 280,
} as const;

export type JourneyMotion = keyof typeof JOURNEY_MOTION_MS;
