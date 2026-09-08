import { ShopPage } from "./ShopPage";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/stage/stage.css";
import "./shop.css";

export default function Page() {
  return (
    <>
      <SceneTransitionProvider reveal="panel-drop">
        <ShopPage />
      </SceneTransitionProvider>
    </>
  );
}
