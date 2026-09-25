import type { D5Catalog } from "../../../game-core/contracts";
import { FACILITIES_CATALOG_DATA } from "../demo-v25/content";
import { SHOP_AIRP_CATALOG_DATA } from "../demo-v24/content";
export const FACILITIES_AIRP_CATALOG_DATA: D5Catalog = {...structuredClone(FACILITIES_CATALOG_DATA), contentVersion: 26, airpDirector: structuredClone(SHOP_AIRP_CATALOG_DATA.airpDirector!)};
