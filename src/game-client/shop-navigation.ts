import { gameHref, type SaveLocator } from "./navigation";

export const appraisalHref = (locator: SaveLocator) => `${gameHref("shop", locator)}&mode=appraise`;
