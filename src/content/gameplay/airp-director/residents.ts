import type { DirectorResidentCast } from "../../../game-core/contracts";

/** Same meeting anchors as the mansion. Effective activities may override this default. */
export const HOUSEHOLD_RESIDENT_CAST: DirectorResidentCast = {
  version: 1,
  locations: {
    marietta: {dawn: "maid", day: "maid", dusk: "dining", night: "array"},
    abyssa: {dawn: "abyssa", day: "abyssa", dusk: "terrace", night: "abyssa"},
  },
};
