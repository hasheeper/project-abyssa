import { navigateTo } from "../shared/routing/location";
import bookIcon from "../assets/icons/items/open-book.svg";
import mariettaBattlePortrait from "../assets/battle/old-manor/marietta-memory-boss.png";
import { useReadSession, useReadState } from "./read-react";
import type { GameSession } from "./session";
import { gameHref, recordLocator } from "./navigation";
import { gameErrorText } from "./game-errors";

/** Visible before the chronicle list; opening a dossier never creates or advances a run. */
export function CharacterMemoryEntry({writer}: {writer: GameSession | null}) {
  const reader = useReadSession(), {record, status} = useReadState();
  const navigate = (href:string) => navigateTo(href);
  if (!record) return null;
  const view = reader.runtime.queries.memory(record);
  const campaign = record.schemaVersion === 4 ? record.snapshot.campaign : null;
  const state = writer?.getSnapshot(), busy = status !== "ready" || !writer || state?.status !== "ready";
  const clockwork = record.contentRef.rulesVersion === 4 && record.contentRef.contentVersion >= 3;
  const home = recordLocator(record);
  const occupied = !!view?.runRef && view.runRef.kind !== "memory";
  const needsStory = campaign?.manor.story?.status === "pending";
  const terminal = campaign?.settlements.find(t => t.id === campaign.manor.story?.terminalId);
  const label = !view ? "续接新内容后开放" : !campaign?.manor.takeover ? "通关庄园后开放" : occupied ? "返回当前远征" : needsStory ? "接续家宴" : view.canInherit ? "承接已通回忆" : view.canRetry ? "重试回忆" : view.runRef?.kind === "memory" ? "继续回忆" : view.canBegin ? view.claim ? "重新挑战" : "开始回忆" : "请先完成当前片段";
  const act = async () => {
    if (occupied) {navigate(gameHref("battle",home));return;}
    if (needsStory && terminal) {navigate(gameHref("battle",{...home,expeditionId:terminal.runId}));return;}
    if (view?.runRef?.kind === "memory" && !view.canRetry) {navigate(gameHref("battle",home));return;}
    if (!writer || !view) return;
    const batch = view.canInherit ? await writer.dispatch({type:"inherit-memory",chapterId:view.chapterId}) : view.canRetry && view.memory
      ? await writer.dispatch({type:"retry-memory",runRef:{kind:"memory",id:view.memory.id,attempt:view.memory.attempt}})
      : view.canBegin ? await writer.dispatch({type:"begin-memory",chapterId:view.chapterId}) : null;
    if (batch) navigate(gameHref("battle",recordLocator(batch.after)));
  };
  const disabled = busy || !campaign?.manor.takeover || !occupied && !needsStory && !view?.canInherit && !view?.canBegin && !view?.canRetry && view?.runRef?.kind !== "memory";
  return <li>
    <section className="abyssa-chronicle__entry character-status-app__memory" data-marker="hollow" data-tone="accent" aria-label="玛丽埃塔回忆战">
      <span className="character-status-app__memory-portrait" aria-hidden="true"><img src={mariettaBattlePortrait} alt=""/></span>
      <div className="abyssa-chronicle__meta"><span className="abyssa-chronicle__stamp">回忆战</span></div>
      <span className="abyssa-chronicle__node" aria-hidden="true"><i style={{maskImage:`url("${bookIcon}")`}}/></span>
      <div className="abyssa-chronicle__body">
        <div className="abyssa-chronicle__head">
          <h4>{clockwork ? "停下来的钟声" : "王座前的提线魔女"}</h4>
          {view?.claim && <span className="abyssa-chronicle__badge">已铭记</span>}
          <div className="character-status-app__memory-actions">
            <button type="button" disabled={disabled} onClick={()=>void act()}>{label}</button>
            {view?.claim && view.memory?.node === "completed" && <a href={gameHref("battle",{saveId:home.saveId,epoch:home.epoch,memory:{id:view.memory.id,attempt:view.memory.attempt}})}>剧情回顾</a>}
          </div>
        </div>
        <p className="abyssa-chronicle__text">勇者小队 · {clockwork ? "旧日钟廊" : "魔王城·王座前"}</p>
        {state?.error && <span className="character-status-app__memory-error" role="alert">{gameErrorText(state.error.code)}</span>}
      </div>
    </section>
  </li>;
}
