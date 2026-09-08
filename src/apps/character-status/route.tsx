import { App } from "./App";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/components-character-status.css";
import "../../shared/ui/styles/components-character-archive.css";
import "../../shared/ui/styles/items.css";
import "../../shared/stage/stage.css";
import "./app.css";

export default function Page() {
  return (
    <>
      <SceneTransitionProvider><App /></SceneTransitionProvider>
    </>
  );
}
