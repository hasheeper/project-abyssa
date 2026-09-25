import { validateD5Catalog } from "../game-core/contracts";
import { FACILITIES_CATALOG_DATA } from "../content/gameplay/demo-v25/content";
import { FACILITIES_AIRP_CATALOG_DATA } from "../content/gameplay/demo-v26/content";
export const FACILITIES_CATALOG = validateD5Catalog(FACILITIES_CATALOG_DATA);
export const FACILITIES_AIRP_CATALOG = validateD5Catalog(FACILITIES_AIRP_CATALOG_DATA);
