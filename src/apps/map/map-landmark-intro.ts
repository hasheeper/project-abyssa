const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const MAP_LANDMARK_DURATION_MS = 1050;
export const MAP_INTRO_DURATION_MS = 1520;

/** Underdamped spring: a clear overshoot, compression, then a smaller rebound.
 * Scale is uniform about the paper's foot: the illustration never stretches.
 * At zeta=.35 the first scale peak is ~1.22, the return trough ~.93.
 */
export function mapLandmarkPose(elapsedMs: number, index: number) {
  const elapsed = elapsedMs - 220 - index * 100;
  const seconds = Math.max(0, elapsed) / 1000;
  const damping = .35, frequency = 13, decay = damping * frequency;
  const oscillation = frequency * Math.sqrt(1 - damping * damping);
  const tail = clamp((elapsed - 850) / (MAP_LANDMARK_DURATION_MS - 850));
  const envelope = 1 - tail * tail * (3 - 2 * tail);
  const displacement = Math.exp(-decay * seconds) *
    (Math.cos(oscillation * seconds) + decay / oscillation * Math.sin(oscillation * seconds)) * envelope;
  return {
    visible: elapsed >= 0,
    rotation: -1.38 * displacement,
    scale: 1 - .72 * displacement,
    opacity: clamp(elapsed / 110),
    labelOpacity: clamp((elapsed - 120) / 240),
  };
}
