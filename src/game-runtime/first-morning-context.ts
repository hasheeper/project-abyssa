import { validateD5Catalog } from "../game-core/contracts";
import { FIRST_MORNING_CATALOG_DATA } from "../content/gameplay/demo-v5/content";
import { MORNING_DEPARTURE_CATALOG_DATA } from "../content/gameplay/demo-v6/content";

export const FIRST_MORNING_V1_CATALOG = validateD5Catalog(FIRST_MORNING_CATALOG_DATA);
export const FIRST_MORNING_CATALOG = validateD5Catalog(MORNING_DEPARTURE_CATALOG_DATA);
