import type { D5Catalog } from "../../../game-core/contracts";
import { LOOP_CATALOG_DATA } from "../demo-v3/content";

/** An independent content identity: existing saves retain their original opening behavior. */
export const PROLOGUE_CATALOG_DATA: D5Catalog = {
  ...structuredClone(LOOP_CATALOG_DATA),
  contentVersion: 4,
  prologue: {
    id: "prologue.first-morning",
    shotIds: ["A1-01", "A1-02", "A1-03", "A1-04", "A2-01", "A2-02", "A2-03", "A2-04", "A3-01", "A3-02", "A3-03", "A3-04", "sound-bridge", "A4-01", "A4-02", "A4-03", "title-card"],
  },
};
