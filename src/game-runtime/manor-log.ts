import type { RuleCatalog, RuleRun } from "../game-core/battle/domain/rule-state";
import type { DemoExpeditionState, DemoCampaign } from "../game-core/session";
import type { DemoEvent } from "../game-core/battle";
export type JourneyLogRecord = { snapshot: { campaign: Pick<DemoCampaign, "settlements" | "manor">; expedition: DemoExpeditionState<RuleRun> | null }; facts: { id: string; runRef: {id: string} | null; kind: string; actorId: string | null; payload: DemoEvent["payload"]; visibility: string }[]; retractedFactIds: string[] };

export function manorReturnFeedback(c: RuleCatalog, record: JourneyLogRecord): string[] {
  const last=record.snapshot.campaign.settlements.at(-1);
  if(!last)return [];
  const lines=[last.outcome === "wipe" ? "余下的配给已收好，休整后还可以再出发。" : last.outcome === "cleared" ? last.routeId === c.manor?.firstClearRouteId ? "玛丽埃塔合上登记簿：今天没有客人。" : "支线残余已清理，庄园重新安静下来。" : record.snapshot.campaign.manor?.takeover ? "这次已保全前三层的维护成果，剩余支线留待下次整理。" : "门厅与走廊的红线暂时安静下来。宴会厅深处，家宴仍未结束。"];
  for(const fact of record.facts) {
    if(fact.runRef?.id!==last.runId || fact.kind!=="event-resolved" || fact.visibility!=="party" || record.retractedFactIds.includes(fact.id))continue;
    const p=fact.payload as {eventId:string;method:string};
    if(c.journey?.events[p.eventId]?.kind!=="relic")continue;
    if(p.method==="strong" || p.method==="weak")lines.push("沿途整理的遗物已得到保全，登记簿留下了这次记录。");
    else if(p.method==="failed")lines.push("这次未能保全走廊的遗物，已如实记入远征记录。");
  }
  return lines;
}

/** Player-facing text derived from committed facts, including undo retractions. */
export function manorLog(c: RuleCatalog, record: JourneyLogRecord) {
  const run = record.snapshot.expedition?.run;
  if (!run) return [];
  const name = (id: unknown): string => {
    if (typeof id !== "string") return "伙伴";
    if (c.characters[id]) return c.characters[id].name;
    const enemy = record.snapshot.expedition?.encounter?.enemies.find(
      (e) => e.id === id,
    );
    return enemy ? (c.enemies[enemy.definitionId].name ?? "敌人") : "敌人";
  };
  let layer = 1,
    round = 1;
  return record.facts
    .filter(
      (f) => f.runRef?.id === run.id && !record.retractedFactIds.includes(f.id),
    )
    .flatMap((f) => {
      const p = f.payload as Record<string, unknown>;
      if (typeof p.layer === "number") layer = p.layer;
      if (f.kind === "round-started" && typeof p.round === "number")
        round = p.round;
      let text = "";
      let tone: "system" | "good" | "bad" | "gold" = "system";
      switch (f.kind) {
        case "memory-dialogue":
          text = String(p.text);
          break;
        case "formation-reordered":
          text = "红线收拢，敌方阵位已重排。出手队列保持不变。";
          break;
        case "formation-unchanged":
          text = "阵位已稳，无需移动。";
          break;
        case "memory-defender-released":
          text = "防线已突破，玛丽埃塔收线止战。";
          break;
        case "memory-item-used":
          text = "使用回忆中的局部补给。";
          break;
        case "expedition-started":
          text = "踏入克雷格旧庄园。";
          break;
        case "encounter-started":
          text = `进入第 ${p.layer} 层，红线牵动了新的宾客。`;
          round = 1;
          break;
        case "round-started":
          text = `第 ${round} 回合，敌方意图已公开。`;
          break;
        case "dice-rolled":
          text = `${p.reroll ? "重掷" : "投掷"}命数骰。`;
          break;
        case "damage-applied":
          text = `${name(f.actorId)} → ${name(p.targetId)}，造成 ${p.applied} 点伤害。`;
          tone = p.targetKind === "enemy" ? "good" : "bad";
          break;
        case "banquet-seats-changed":
          text = `席位 ${p.before} → ${p.after}，举杯基础伤害 ${p.toastPower}。`;
          break;
        case "enemy-summoned":
          text = "补入一位候席客，下一回合行动。";
          break;
        case "enemy-released":
          text = Number(p.bounty) ? "千金的吊线已解除，家宴到此结束。" : "余客随规约解除，安静退场。";
          tone = "good";
          break;
        case "enemy-defeated":
          text = record.snapshot.expedition?.encounter?.memory ? "侍偶倒下，防线收拢。" : `敌人倒下，拾取 ${p.bounty}G。`;
          tone = record.snapshot.expedition?.encounter?.memory ? "good" : "gold";
          break;
        case "healing-applied":
          text = `${name(p.targetId)}恢复 ${p.applied} 点生命。`;
          tone = "good";
          break;
        case "enemy-repaired":
          text = `缝补女佣为同伴修复 ${p.applied} 点生命。`;
          break;
        case "guard-applied":
          text = `${name(p.targetId)}的来袭意图受到 ${p.amount} 点格挡。`;
          tone = "good";
          break;
        case "seal-scheduled":
          text = `${name(p.targetId)}的命数骰将在下回合封锁。`;
          tone = "bad";
          break;
        case "unit-downed":
          text = `${name(f.actorId)}力竭，命数留下暂时锈蚀。`;
          tone = "bad";
          break;
        case "layer-banked":
          text = `第 ${p.layer} 层结算 ${p.gold}G，已放入包裹。`;
          tone = "gold";
          break;
        case "item-used":
          text = `使用${c.journey?.items[String(p.definitionId)]?.name ?? "配给"}，剩余 ${p.remaining} 次。`;
          break;
        case "event-resolved":
          text =
            p.method === "read"
              ? p.eventId === "event.old-manor.seats" ? "核对空席：宾客增强举杯，主位仍是陷阱。" : "读过迎宾簿，留下关于主人权限的线索。"
              : p.method === "skip"
                ? "谨慎绕行，继续前进。"
                : `整理遗物：${p.method === "failed" ? "未能保全" : "保全成功"}。`;
          break;
        case "expedition-finished":
          text =
            p.outcome === "wipe"
              ? "队伍力竭，强行撤回。"
              : p.outcome === "cleared" ? "全程完成，返回洋馆。" : "从第三层出口带宝离场。";
          break;
      }
      return text ? [{ layer, round, text, tone }] : [];
    })
    .slice(-40);
}
