import { expect, it } from "vitest";
import { confirmationTransition } from "./confirmation-motion";

it("introduces a still center panel from scrim/backing through content to separate buttons", () => {
  const scrim = confirmationTransition("scrim", true, false);
  const surface = confirmationTransition("surface", true, false);
  const content = confirmationTransition("content", true, false);
  const cancel = confirmationTransition("action", true, false, 0);
  const confirm = confirmationTransition("action", true, false, 1);
  expect(scrim.delay).toBe(0);
  expect(surface.delay).toBeGreaterThan(scrim.delay);
  expect(content.delay).toBeGreaterThan(surface.delay);
  expect(cancel.delay).toBeGreaterThan(content.delay);
  expect(confirm.delay).toBeGreaterThan(cancel.delay);
  expect(confirm.delay + confirm.duration).toBeCloseTo(.525);
});

it("reverses the layer order and keeps modal ownership until every track finishes", () => {
  const confirm = confirmationTransition("action", false, false, 1);
  const cancel = confirmationTransition("action", false, false, 0);
  const content = confirmationTransition("content", false, false);
  const surface = confirmationTransition("surface", false, false);
  const scrim = confirmationTransition("scrim", false, false);
  expect(confirm.delay).toBe(0);
  expect(cancel.delay).toBeGreaterThan(confirm.delay);
  expect(content.delay).toBeGreaterThan(cancel.delay);
  expect(surface.delay).toBeGreaterThan(content.delay);
  expect(scrim.delay).toBeGreaterThan(surface.delay);
  const removal = scrim.duration + scrim.delay;
  for (const part of [confirm, cancel, content, surface]) expect(part.duration + part.delay).toBeLessThan(removal);
  expect(removal).toBeCloseTo(.42);
});

it("removes stagger delays for reduced motion, including the exit", () => {
  for (const present of [true, false]) for (const part of ["scrim", "surface", "content", "action"] as const) {
    expect(confirmationTransition(part, present, true)).toMatchObject({ duration: .08, delay: 0, type: "tween" });
  }
});
