import type { ReactNode } from "react";
import { useDirector } from "./useDirector";
import { useDirectorFlow } from "./useDirectorFlow";
import { GenerationFlow } from "../airp-generation/GenerationFlow";
import { AiSettingsButton } from "../settings/AiSettingsButton";
import { CallLog } from "../airp-generation/CallLog";
import { directorCallLog } from "../../game-runtime/airp-call-log";
import { DirectorDayLauncher } from "./DirectorDayLauncher";
import { GameOperationFeedback } from "../GameOperationFeedback";
import "../airp-generation/direct-game.css";

export function DirectorControls({jobId, title, location, background, reader, initialReader, onBackground, active}: {
  jobId?: string; title?: string; location?: string; background?: string;
  reader?: (close: () => void) => ReactNode; initialReader?: boolean; onBackground?: () => void;
  active?: boolean;
}) {
  const d = useDirector(), flow = useDirectorFlow(d, jobId);
  if (!d.view) return null;
  const {job} = flow;
  return <><GameOperationFeedback session={d.session} state={d.game} local managed/><GenerationFlow task={{...flow.task, title:title ?? flow.task.title, location:location ?? flow.task.location}}
    actions={flow.actions} background={background} reader={reader} initialReader={initialReader} readerLocked onBackground={onBackground} backgroundOwner={d.taskSession}
    active={active} initiallyClosed={!jobId || active === false} initiallyExposed={!!job && flow.task.phase !== "done"} launcher={!jobId ? open => <DirectorDayLauncher task={flow.task} onOpen={open}/> : undefined}
    details={flow.error ? <p>{flow.error}</p> : undefined}
    footer={<><AiSettingsButton label="连接设置"/>{job && <CallLog entries={directorCallLog(job,d.view!.state.materials[job.materialHash],d.view!.memoryDiagnostics)} warnings={job.lowWarnings}/>}</>}/></>;
}
