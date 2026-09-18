import { validateD5Catalog } from "../game-core/contracts";
import { AIRP_CATALOG_DATA } from "../content/gameplay/demo-v8/content";
import { AIRP_POOL_CATALOG_DATA } from "../content/gameplay/demo-v9/content";
import { AIRP_ONLINE_CATALOG_DATA } from "../content/gameplay/demo-v10/content";

export const AIRP_CATALOG = validateD5Catalog(AIRP_CATALOG_DATA);
export const AIRP_POOL_CATALOG = validateD5Catalog(AIRP_POOL_CATALOG_DATA);
export const AIRP_ONLINE_CATALOG = validateD5Catalog(AIRP_ONLINE_CATALOG_DATA);
