import { validateD5Catalog } from "../game-core/contracts";
import { LOOP_CATALOG_DATA } from "../content/gameplay/demo-v3/content";

export const LOOP_CATALOG = validateD5Catalog(LOOP_CATALOG_DATA);
