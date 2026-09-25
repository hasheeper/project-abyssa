import { useId, type ReactNode } from "react";
import { GenerationFlow, type GenerationAction } from "./GenerationFlow";
import type { FlowPhase } from "../../shared/ui/patterns/flow/contracts";
import "./direct-game.css";

/** Compatibility surface for authored/direct source decisions and completed-scene guidance. */
export function DirectGenerationScene({title, location, background, children, onClose, closeDisabled = false,
  status = "准备继续", phase = "waiting", actions = [], active, taskId, variant}: {
  title: string; location: string; background: string; children?: ReactNode;
  onClose?: () => void; closeDisabled?: boolean; status?: string; phase?: FlowPhase;
  actions?: readonly GenerationAction[]; active?: boolean; taskId?: string;
  variant?: "guide";
}) {
  const id = useId();
  return <GenerationFlow task={{key:taskId ?? id,title,location,status,phase,
    primary:actions[0],secondary:actions[1],utilities:actions.slice(2)}} actions={actions}
    variant={variant} background={background} onBackground={onClose} initiallyClosed={active === false} initiallyExposed={!!taskId || active !== false} active={active}>
    <div aria-busy={closeDisabled}>{children}</div>
  </GenerationFlow>;
}
