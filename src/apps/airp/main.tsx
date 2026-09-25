import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GenerationWorkbench } from "../../game-client/airp-generation/GenerationWorkbench";
import { createGenerationController } from "../../game-runtime/airp-generation";
import { UiMotionProvider } from "../../shared/ui/motion/UiMotionProvider";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/stage/stage.css";

const controller = createGenerationController();
createRoot(document.getElementById("root")!).render(<StrictMode><UiMotionProvider><GenerationWorkbench controller={controller}/></UiMotionProvider></StrictMode>);
