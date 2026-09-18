import { validateD5Catalog } from "../game-core/contracts/d5-validation";
import { GUIDED_TIDE_CATALOG_DATA } from "../content/gameplay/demo-v11/content";

export const GUIDED_TIDE_CATALOG = validateD5Catalog(GUIDED_TIDE_CATALOG_DATA);
