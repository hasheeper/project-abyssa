import { useState } from "react";
import { InlineFeedback } from "../../shared/ui/patterns/SceneFeedback";
import { JournalButton } from "../JournalPrimitives";
import { GameOperationFeedback } from "../GameOperationFeedback";
import { useDirector } from "./useDirector";
import { DirectorControls } from "./DirectorControls";

export function DirectorMemory({sceneId}: {sceneId: string}) {
  const d = useDirector(), [error, setError] = useState("");
  if (!d.view) return null;
  if ([22, 24, 26, 28].includes(d.game.record?.contentRef.contentVersion ?? 0)) return <p>原文完整保留，记忆在行动反馈或事件收尾时统一结算。</p>;
  const jobId = `excerpt:${sceneId}`, job = d.view.state.jobs.find(j => j.id === jobId);
  if (job) return job.excerpt ? <p>已读摘录已保存，原文仍完整保留。</p> : <DirectorControls jobId={jobId}/>;
  return <><GameOperationFeedback session={d.session} state={d.game} local/><JournalButton disabled={d.game.status !== "ready" || d.progress.busy} onClick={() => void (async () => {
    try {await d.send({type: "airp-director-prepare-memory", jobId: sceneId}); await d.run(jobId);} catch {setError("摘录未完成，请重试；已读原文保留。");}
  })()}>整理本段记忆</JournalButton>{error && !d.game.error && <InlineFeedback message={error}/>}</>;
}
