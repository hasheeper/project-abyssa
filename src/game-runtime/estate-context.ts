import { validateD5Catalog } from "../game-core/contracts";
import { ESTATE_CATALOG_DATA } from "../content/gameplay/demo-v27/content";
import { ESTATE_AIRP_CATALOG_DATA } from "../content/gameplay/demo-v28/content";
export const ESTATE_CATALOG = validateD5Catalog(ESTATE_CATALOG_DATA);
export const ESTATE_AIRP_CATALOG = validateD5Catalog(ESTATE_AIRP_CATALOG_DATA);
