import type { D5Catalog } from "../../../game-core/contracts";
import { TIDE_CAVE_CATALOG_DATA } from "../demo-v7/content";
import { AIRP_POOL_CONTENT } from "../airp-v2/content";

/** AIRP-3: immutable pool/rules identity. Content 8 still executes AIRP contract 1. */
export const AIRP_POOL_CATALOG_DATA: D5Catalog = {
  ...structuredClone(TIDE_CAVE_CATALOG_DATA), contentVersion: 9, airp: AIRP_POOL_CONTENT,
};
