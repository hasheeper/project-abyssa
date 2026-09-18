import { expect, it } from "vitest";
import { mapLandmarkPose, MAP_INTRO_DURATION_MS } from "./map-landmark-intro";
it("stands three paper landmarks up in sequence with a visible spring overshoot", () => {
  expect([0, 1, 2].map(index => mapLandmarkPose(260, index).visible)).toEqual([true, false, false]);
  expect(mapLandmarkPose(220, 0).rotation).toBeCloseTo(-1.38);
  const peak = mapLandmarkPose(478, 0), trough = mapLandmarkPose(736, 0), rebound = mapLandmarkPose(994, 0);
  expect(peak.scale).toBeGreaterThan(1.20);
  // Camera-facing X tilt alone barely changes apparent height. Check the actual
  // projected silhouette so a four-degree nod cannot masquerade as a rebound.
  expect(peak.scale * Math.cos(peak.rotation)).toBeGreaterThan(1.10);
  expect(trough.scale).toBeLessThan(.94);
  expect(rebound.scale).toBeGreaterThan(1.015);
  for (const index of [0, 1, 2]) {
    const pose = mapLandmarkPose(MAP_INTRO_DURATION_MS, index);
    expect(pose.scale).toBe(1); expect(pose.rotation).toBeCloseTo(0);
    expect(pose.opacity).toBe(1); expect(pose.labelOpacity).toBe(1);
  }
});
it("reveals the label after its landmark, with bounded overshoot", () => {
  for (let time = 0; time <= MAP_INTRO_DURATION_MS; time += 16) {
    const pose = mapLandmarkPose(time, 0);
    expect(pose.labelOpacity).toBeLessThanOrEqual(pose.opacity);
    expect(pose.rotation).toBeGreaterThanOrEqual(-1.38);
    expect(pose.rotation).toBeLessThan(.44);
    expect(pose.scale).toBeGreaterThanOrEqual(.28);
    expect(pose.scale).toBeLessThan(1.23);
  }
});
