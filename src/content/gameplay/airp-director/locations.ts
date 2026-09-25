import type { DirectorCapabilities } from "../../../game-core/contracts";

/** Shared playable meeting locations for the new release; IDs match the mansion map. */
export const DIRECTOR_LOCATIONS: DirectorCapabilities["locations"] = {
  eustice: {dawn: "eustice", day: "plaza", dusk: "plaza", night: "eustice"},
  norma: {dawn: "norma", day: "tibby", dusk: "plaza", night: "norma"},
  elora: {dawn: "elora", day: "greenhouse", dusk: "plaza", night: "elora"},
  kororo: {dawn: "kororo", day: "kororo", dusk: "plaza", night: "kororo"},
};
