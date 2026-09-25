import type { D5Catalog } from "../../../game-core/contracts";
import { ESTATE_CATALOG_DATA } from "../demo-v27/content";
import { FACILITIES_AIRP_CATALOG_DATA } from "../demo-v26/content";
export const ESTATE_AIRP_CATALOG_DATA: D5Catalog = {...structuredClone(ESTATE_CATALOG_DATA), contentVersion: 28, airpDirector: structuredClone(FACILITIES_AIRP_CATALOG_DATA.airpDirector!)};
