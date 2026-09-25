import { useTutorialAnchors } from "../../../shared/tutorial";
import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import camp from "../../../assets/icons/items/camping-tent.svg";
import type { JourneyEventCopy } from "./ManorJourneyPanel";

export const tideEventCopy: JourneyEventCopy = {
  location: "退潮岩窟 · 背风石阶", resultTitle: "潮坑落货 · 结果",
  description: "一只硬皮包卡在潮坑的石缝里，海水正浸着包底。锁扣已经生锈，硬扯可能连包里的东西一起损坏。派一名队员试着打开它，其他人留在石阶上照应。",
  conditions: "使用所选队员的专属骰独立判定，不消耗战斗骰，无法重掷。",
  results: {
    strong: "顺着锁扣的缝隙慢慢撬动，锈死的搭扣终于松开了。皮包外层虽然湿透，内衬却还完好，里面的杂物没有被海水浸坏。",
    weak: "锁扣松开时，海水已经渗进了内衬。来得及保住其中一部分，但其余物件已经泡得难以辨认，只能到此为止。",
    failed: "锁扣迟迟没能打开。等皮包从石缝间松脱，内里已经灌满海水，没能保住其中的物件。众人退回石阶，准备继续前进。",
    skip: "众人没有再去碰潮坑里的皮包，沿着石阶向上走。要找的三件货，还在前方。", read: "皮包已经检查过了，队伍可以继续前行。",
  },
};

export function tideEventVisible(view: DemoJourneyView) {
  return view.tutorial?.node?.battle === null && ["event", "room-complete"].includes(view.expedition?.node ?? "");
}

export function tideJourneyTitle(view: DemoJourneyView) {
  if (tideEventVisible(view)) return view.expedition?.node === "event" ? view.event!.name : tideEventCopy.resultTitle;
  return view.tutorial?.canRetry ? "重新整队" : view.tutorial?.canClaim ? "物归原主" : "片刻整备";
}
export function TideJourneyPanel({view}: {view: DemoJourneyView}) {
  const t = view.tutorial!;
  return <section className="manor-journey" aria-label={tideJourneyTitle(view)} data-kind="rest">
    <div className="manor-journey__reading">
      <header className="manor-journey__heading"><i style={{maskImage: `url("${camp}")`}} aria-hidden="true"/><div>
        <small>{`退潮岩窟 · 第 ${view.expedition!.run.layer} / ${view.layerCount} 层 · 遭遇 ${t.encounter} / 4`}</small><h2>{tideJourneyTitle(view)}</h2>
      </div></header>
      <div className="manor-journey__text">
        <p>{t.canRetry ? "选择重试本场，或从岩窟入口重新开始。" : "伤势与剩余补给保留至下一场，可使用道具恢复生命。"}</p>
      </div>
    </div>
  </section>;
}
export function TideJourneyActions({view, busy, onRetry, onAdvance, canAdvance = true}: {view: DemoJourneyView; busy: boolean; onRetry: (scope: "encounter" | "chapter") => void; onAdvance: () => void; canAdvance?: boolean}) {
  const t = view.tutorial!, anchor = useTutorialAnchors();
  return <div className="manor-journey-actions">
    {t.canRetry ? <DiceActionButton label="从入口重来" disabled={busy} onClick={() => onRetry("chapter")}/> : <span/>}
    <span>{t.canRetry ? "恢复对应起点" : "可使用道具整备"}</span>
    <DiceActionButton primary ref={t.canRetry ? undefined : anchor("battle.advance")} label={t.canRetry ? "重试本场" : "继续前进"} disabled={busy || !t.canRetry && !canAdvance} onClick={t.canRetry ? () => onRetry("encounter") : onAdvance}/>
  </div>;
}
