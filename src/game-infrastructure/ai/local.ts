import type {
  AiApplicationPort,
  AiRequest,
  AiResponse,
} from "../../game-application/ai";
/** Deterministic presentation only. No prompt pipeline, provider, network or game writes. */
export class LocalReactionPort implements AiApplicationPort {
  start(request: AiRequest) {
    let cancelled = false;
    const evidence = request.facts.find((f) =>
      [
        "expedition-started",
        "damage-applied",
        "healing-applied",
        "layer-cleared",
        "expedition-finished",
        "expedition-settled",
      ].includes(f.kind),
    );
    const templates: Record<string, string> = {
      "expedition-started": "一起走吧，彼此照应。",
      "damage-applied": "小心些，我们还在这里。",
      "healing-applied": "缓过来了，谢谢。",
      "layer-cleared": "先喘口气，再决定下一步。",
      "expedition-finished": "这趟结束了，大家辛苦了。",
      "expedition-settled": "已经回到洋馆了，先休息一下吧。",
    };
    const text = evidence ? templates[evidence.kind] : "";
    const output: AiResponse = {
      version: 1,
      task: "react-to-commit",
      cueId: request.cueId,
      source: { ...request.source },
      expeditionId: request.expeditionId,
      sceneId: request.sceneId,
      lines:
        evidence && text.length <= request.budget.maxCharacters
          ? [
              {
                speakerId: request.actorIds[0],
                text,
                emoteId: null,
                actionId: null,
                factIds: [evidence.id],
              },
            ]
          : [],
    };
    return {
      result: Promise.resolve().then(() =>
        cancelled
          ? { status: "cancelled" as const }
          : { status: "success" as const, output },
      ),
      cancel() {
        cancelled = true;
      },
    };
  }
}
