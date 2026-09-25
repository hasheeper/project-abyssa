import type { ReactNode } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgHeader } from "../../shared/ui/primitives/RpgHeader";
import { MetalCorner } from "../../shared/ui/decorations/MetalCorner";
import { Stage } from "../../shared/stage";
import { SceneArrivalTitle } from "../../shared/transition";
import type { ShopIntroState } from "./useShopIntro";

/** Shop-local frame: preserve the established geometry and route entrance. */
export function ShopFrame({ children, className = "", intro, feedback, navigation, embedded = false }: {
  children: ReactNode;
  feedback?: ReactNode;
  navigation?: ReactNode;
  /** The route owns the single canvas when switching between AVG and counter. */
  embedded?: boolean;
  className?: string;
  intro?: { state: ShopIntroState; reduced: boolean };
}) {
  const content = <>
    <SceneArrivalTitle eyebrow="WATCHER'S CLIFF · MARKET" title="守望者杂货铺" tone="gold" />
    <AbyssaProvider className={`abyssa-shop-screen ${intro ? "" : "abyssa-scene-panel"} ${className}`} data-skin="black-gold"
      data-shop-intro={intro?.state} data-shop-reduced={intro?.reduced}>
      <header className="abyssa-shop-screen__header"><RpgHeader label="WARDEN SHOP" /></header>
      <div className="abyssa-shop-screen__shell">
        <span className="abyssa-shop-screen__shell-rails" aria-hidden="true">
          {(["top", "right", "bottom", "left"] as const).map(edge => <i key={edge} data-edge={edge} />)}
        </span>
        <div className="abyssa-shop-screen__shell-brass">
          <div className="abyssa-shop-screen__shell-board">
            <span className="abyssa-shop-screen__shell-corners" aria-hidden="true">
              {(["tl", "tr", "br", "bl"] as const).map(corner => <MetalCorner key={corner} corner={corner} />)}
            </span>
            {children}
          </div>
        </div>
      </div>
      {feedback}
    </AbyssaProvider>
    {navigation}
  </>;
  return embedded ? content : <Stage background="var(--abyssa-shop-backdrop)" canvasClassName="abyssa-shop-stage">{content}</Stage>;
}
