/** Shared visual duration for physical dice and expedition reels. */
export function randomRollDuration(random = Math.random) {
  return 0.85 + random() * 0.45;
}
