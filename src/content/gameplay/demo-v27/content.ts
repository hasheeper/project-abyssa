import type { D5Catalog } from "../../../game-core/contracts";
import { FACILITIES_CATALOG_DATA } from "../demo-v25/content";
const data = structuredClone(FACILITIES_CATALOG_DATA);
data.facilities!.construction = {
  basePrices: {kitchen: 200_000, greenhouse: 260_000, workshop: 240_000, storage: 300_000, maid: 80_000},
  funding: {initial: 500_000, weekly: [450_000, 475_000, 500_000, 525_000, 550_000]},
};
export const ESTATE_CATALOG_DATA: D5Catalog = {...data, contentVersion: 27};
