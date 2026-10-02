import { useMemo, useRef } from "react";
import type { SystemSceneMotion } from "../system-panel-motion";
import { useCodexDial, useCodexImage, useCodexMotion } from "./codex-motion";
import "./codex-panel.css";
import type { CodexStage, CodexEntryData } from "../../game-runtime/codex-types";

export type CodexEntry = {
  id: string; number: string; name: string; englishName: string; family: string;
  image: string; thumbnail: string; description: string;
  drawing: { width: number; height: number; centerX: number; displayScale: number; offsetY: number };
  tags: readonly string[];
  stage?: CodexStage;
  dropsStatus?: CodexEntryData["dropsStatus"];
  facts: readonly { label: string; value: string }[];
  note?: { text: string; source: string };
  drops: readonly { id: string; name: string; icon: string; description: string }[];
};

export function codexArtLayout(drawing: CodexEntry["drawing"]) {
  const width = Math.min(550, 400 * drawing.width / drawing.height, 564 / (2 * Math.max(drawing.centerX, 1 - drawing.centerX))) * drawing.displayScale;
  const height = width * drawing.height / drawing.width;
  return { width, height, offsetX: width * (.5 - drawing.centerX), offsetY: drawing.offsetY };
}

export function CodexPanel({ entries, initialEntryId, onBack, sceneMotion, unavailable }: {
  entries: readonly CodexEntry[]; initialEntryId?: string; onBack: () => void; sceneMotion: SystemSceneMotion; unavailable?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const images = useMemo(() => entries.map(item => item.image).filter(Boolean), [entries]);
  const ids = useMemo(() => entries.map(item => item.id), [entries]);
  const { selectedId, displayedId, select, imageClock } = useCodexMotion(root, sceneMotion, initialEntryId ?? entries.find(item => item.stage !== "unknown")?.id ?? entries[0]?.id, images);
  useCodexDial(root, selectedId, ids, sceneMotion);
  const selectedIndex = Math.max(0, entries.findIndex(item => item.id === displayedId));
  const entry = entries[selectedIndex];
  useCodexImage(entry?.image, sceneMotion.skip, sceneMotion.exiting, imageClock);
  if (!entry) return <section ref={root} className="codex-panel codex-panel--empty" aria-label="图鉴资料">
    <div className="codex-empty" data-codex-reveal="description"><h2>{unavailable ? "暂时无法读取图鉴" : "尚无图鉴条目"}</h2><p>{unavailable ?? "遇见生物后，会在这里留下记录。"}</p></div>
    <div className="codex-footer"><span/><button type="button" onClick={onBack} data-codex-reveal="footer"><i aria-hidden="true"/>返回</button></div>
  </section>;
  const stage = entry.stage ?? "defeated";
  const dropPlaceholder = stage === "unknown" ? "尚未收录" : stage === "seen" ? "击败后记录" : entry.dropsStatus === "none" ? "无掉落" : "尚未记录";
  const artLayout = codexArtLayout(entry.drawing);
  return <section ref={root} className="codex-panel" aria-label="图鉴资料" data-codex-entry={entry.id} data-codex-stage={stage}>
    <div className="codex-categories" data-codex-reveal="structure">
      <span className="codex-category" aria-current="true">生物</span>
      <span className="codex-category" aria-disabled="true">地点</span>
      <span className="codex-category" aria-disabled="true">器物</span>
      <span className="codex-category" aria-disabled="true">世界知识</span>
      <span className="codex-category-caption">生物图鉴</span>
    </div>

    <div className="codex-index">
      <div className="codex-index__heading"><span data-codex-reveal="structure">生物</span><i aria-hidden="true" data-codex-reveal="structure">/</i><span data-codex-reveal="title">{entry.family}</span></div>
      <nav aria-label="生物条目" data-codex-reveal="index">
        {entries.map((item, index) => <button key={item.id} type="button" className="codex-index__entry"
          aria-current={item.id === selectedId ? "true" : undefined} aria-label={item.stage === "unknown" ? `未收录 No.${item.number}` : item.name} tabIndex={item.id === selectedId ? 0 : -1}
          onClick={() => select(item.id)} onKeyDown={event => {
            const target = event.key === "ArrowDown" ? Math.min(index + 1, entries.length - 1)
              : event.key === "ArrowUp" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : null;
            if (target === null) return;
            event.preventDefault(); select(entries[target].id);
            event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("button")[target].focus();
          }}>
          <svg className="codex-index__outline" viewBox="0 0 230 82" preserveAspectRatio="none" aria-hidden="true">
            <path d="M1 1H229V81H1Z"/>
            <path className="codex-index__inner" d="M13 4H217L226 13V69L217 78H13L4 69V13Z"/>
            <path className="codex-index__corner" d="M4 18V4H18M212 4H226V18M226 64V78H212M18 78H4V64"/>
          </svg>
          {item.thumbnail ? <img src={item.thumbnail} alt="" draggable={false}/> : <i className="codex-index__unknown" aria-hidden="true">?</i>}
          <span><strong>{item.name}</strong><small>No.{item.number}</small></span>
        </button>)}
      </nav>
      <div className="codex-index__count"><span data-codex-reveal="structure">条目索引</span><span data-codex-reveal="title">{String(selectedIndex + 1).padStart(2, "0")} / {entries.length}</span></div>
    </div>

    <div className="codex-observation">
      <figure>
        <figcaption><span data-codex-reveal="title">No.{entry.number}</span><small data-codex-reveal="structure">形态观察</small></figcaption>
        <div className="codex-observation__field">
          <svg className="codex-observation__dial" viewBox="0 0 480 480" aria-hidden="true">
            <circle cx="240" cy="240" r="228"/>
            <circle cx="240" cy="240" r="220"/>
            <circle className="codex-observation__inner-ring" cx="240" cy="240" r="207"/>
            <path className="codex-observation__axes" d="M240 25V216M240 264V455M25 240H216M264 240H455"/>
            {[0, 90, 180, 270].map(angle => <g key={angle} transform={`rotate(${angle} 240 240)`}>
              <path d="M240 2L252 16L240 30L228 16ZM240 10L245 16L240 22L235 16ZM240 0V37"/>
            </g>)}
            {[30, 60, 120, 150, 210, 240, 300, 330].map(angle => <path className="codex-observation__tick" key={angle} transform={`rotate(${angle} 240 240)`} d="M240 12V28M240 45V63"/>)}
          </svg>
          <div className="codex-observation__art">
            {entry.image ? <img src={entry.image} alt={`${entry.name}的观察草图`} draggable={false} data-codex-reveal="art"
              style={{ width: artLayout.width, height: artLayout.height, transform: `translate(calc(-50% + ${artLayout.offsetX}px), calc(-50% + ${artLayout.offsetY}px)) scale(var(--codex-art-scale, 1))` }}/> : <span className="codex-observation__unknown" aria-hidden="true" data-codex-reveal="art">?</span>}
          </div>
        </div>
      </figure>
    </div>

    <div className="codex-details">
      <article aria-labelledby="codex-specimen-title">
        <header className="codex-details__heading">
          <h2 id="codex-specimen-title" data-codex-reveal="title">{entry.name}</h2>
          <p data-codex-reveal="title">{entry.englishName}</p>
        </header>
        <div className="codex-tags" data-codex-reveal="title">{entry.tags.map(tag => <span key={tag}>
          <svg viewBox="0 0 112 26" preserveAspectRatio="none" aria-hidden="true"><path d="M10 1H102L111 13L102 25H10L1 13Z"/></svg>
          {tag}
        </span>)}{entry.stage && <small className="codex-stage">{stage === "unknown" ? "未遇见" : stage === "seen" ? "已遇见 · 资料未完整" : "已击败 · 完整记录"}</small>}</div>
        <p className="codex-description" data-codex-reveal="description">{entry.description}</p>
        <section className="codex-facts" aria-label="已知情报">
          <h3 data-codex-reveal="structure">已知情报</h3>
          <dl data-codex-reveal="facts">{entry.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>
        </section>
        <section className="codex-drops" aria-label="可能掉落">
          <h3 data-codex-reveal="structure">可能掉落</h3>
          <ul>
            {Array.from({ length: Math.max(4, entry.drops.length) }, (_, index) => {
              const drop = entry.drops[index];
              return <li className={drop ? undefined : "codex-drops__unknown"} key={index} aria-label={drop ? `${drop.name}：${drop.description}` : dropPlaceholder}>
                <span className="codex-drops__image" aria-hidden="true">
                  <span className="codex-drops__content" data-codex-reveal="drops">{drop
                    ? <i style={{ maskImage: `url("${drop.icon}")`, WebkitMaskImage: `url("${drop.icon}")` }}/>
                    : <span className="codex-drops__question">?</span>}</span>
                </span>
                <h4 data-codex-reveal="drops">{drop?.name ?? dropPlaceholder}</h4>
              </li>;
            })}
          </ul>
        </section>
      </article>
    </div>

    <div className="codex-record">
      <svg className="codex-record__outline" viewBox="0 0 844 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M14 1H830L843 14V126L830 139H14L1 126V14Z"/>
        <path className="codex-record__inner" d="M17 6H827L838 17V123L827 134H17L6 123V17Z"/>
        <path className="codex-record__corner" d="M1 29V14L14 1H34M810 139H830L843 126V111"/>
      </svg>
      <section aria-label="图鉴记录">
        <h3 data-codex-reveal="structure">图鉴记录</h3>
        <p data-codex-reveal="record">{entry.note?.text ?? (stage === "unknown" ? "遇见后开始记录。" : stage === "seen" ? "击败后，补全这份记录。" : "暂未有进一步的记录。")}</p>
        <span className="codex-record__source" data-codex-reveal="record">{entry.note?.source ?? "待记录"}</span>
      </section>
    </div>

    <div className="codex-footer">
      <span data-codex-reveal="title">生物 · {entry.family}</span>
      <button type="button" onClick={onBack} data-codex-reveal="footer"><i aria-hidden="true"/>返回</button>
    </div>
  </section>;
}
