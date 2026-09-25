import { App } from "./App";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { prepareImages } from "../../shared/loading/images";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/components-character-status.css";
import "../../shared/ui/styles/components-character-archive.css";
import "../../shared/ui/styles/items.css";
import "../../shared/stage/stage.css";
import "./app.css";

export const prepare = () => prepareImages([manorNightGallery]);

export default function Page() {
  return (
    <>
      <SceneTransitionProvider><App /></SceneTransitionProvider>
    </>
  );
}
