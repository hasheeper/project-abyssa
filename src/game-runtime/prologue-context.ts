import { validateD5Catalog } from "../game-core/contracts";
import { PROLOGUE_CATALOG_DATA } from "../content/gameplay/demo-v4/content";

export const PROLOGUE_CATALOG = validateD5Catalog(PROLOGUE_CATALOG_DATA);
