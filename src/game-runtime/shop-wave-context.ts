import { validateD5Catalog } from "../game-core/contracts";
import { SHOP_WAVE_CATALOG_DATA } from "../content/gameplay/demo-v23/content";
import { SHOP_AIRP_CATALOG_DATA } from "../content/gameplay/demo-v24/content";
export const SHOP_WAVE_CATALOG = validateD5Catalog(SHOP_WAVE_CATALOG_DATA);
export const SHOP_AIRP_CATALOG = validateD5Catalog(SHOP_AIRP_CATALOG_DATA);
