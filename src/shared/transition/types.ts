export type SceneTransitionPhase = "idle" | "closing" | "closed" | "opening";

/**
 * Incoming scene reveal treatment.
 *
 * `panel-drop` is reserved for contained application panels (shop, battle,
 * inventory, and similar screens). Full-screen world scenes should keep the
 * default fade so their scenery never appears to be a movable sheet.
 */
export type SceneRevealMode = "fade" | "panel-drop";

export interface SceneTransitionCopy {
  /** 目标场景名。只在黑幕期间显示，不承担真实进度。 */
  destination?: string;
  /** 很短的系统分区名，例如 MANOR NETWORK。 */
  channel?: string;
}

export interface SceneNavigationOptions extends SceneTransitionCopy {
  /** 默认 push；只在明确替换当前历史记录时使用。 */
  replace?: boolean;
}
