import { expect, it } from "vitest";
import { confirmationTransition } from "../../motion/confirmation-motion";
import { flowSceneTransition, flowTransition } from "./flow-motion";

it("keeps every withdrawing layer within the modal's actual presence lifetime", () => {
  for (const reduced of [false, true]) for (const origin of ["center", "rail"] as const) {
    const scrim = confirmationTransition("scrim", false, reduced);
    for (const part of ["surface", "tint", "content", "action"] as const) for (const index of [0, 1] as const) {
      const track = flowTransition(part, false, reduced, origin, index);
      expect(track.delay + track.duration).toBeLessThanOrEqual(scrim.delay + scrim.duration);
      if (reduced) expect(track.delay).toBe(0);
    }
    for (const part of ["curtain", "view", "settle"] as const) for (const exitTo of ["rail", "reader"] as const) {
      const track = flowSceneTransition(part, false, reduced, origin, exitTo);
      expect(track.delay + track.duration).toBeLessThanOrEqual(scrim.delay + scrim.duration);
      if (reduced) expect(track).toMatchObject({delay: 0, duration: .08});
    }
  }
});

it("restores from the rail sooner and keeps room, panel, text and actions in order", () => {
  for (const origin of ["center", "rail"] as const) {
    const tracks = [flowSceneTransition("curtain",true,false,origin,"rail"), flowSceneTransition("view",true,false,origin,"rail"),
      ...(["surface", "tint", "content", "action"] as const).map(part=>flowTransition(part,true,false,origin))];
    tracks.slice(1).forEach((track,index)=>expect(track.delay).toBeGreaterThan(tracks[index].delay));
  }
  const first = flowTransition("action",true,false,"center",1), restored = flowTransition("action",true,false,"rail",1);
  expect(restored.delay + restored.duration).toBeLessThan(first.delay + first.duration);
});
