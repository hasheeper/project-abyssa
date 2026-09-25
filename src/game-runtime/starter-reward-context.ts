import { validateD5Catalog } from "../game-core/contracts";
import { STARTER_REWARD_CATALOG_DATA } from "../content/gameplay/demo-v15/content";

export const STARTER_REWARD_CATALOG = validateD5Catalog(STARTER_REWARD_CATALOG_DATA);
