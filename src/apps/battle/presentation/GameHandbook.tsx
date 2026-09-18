import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import copy from "../../../content/presentation/tutorial/handbook.json";
import { supplyArt } from "../../../content/presentation/supply-icons";
import { ExpeditionFlatDieFrame, EXPEDITION_DIE_STAMP_ICONS, type ExpeditionDieStampAction } from "../../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import { RpgModal } from "../../../shared/ui/primitives/RpgModal";
import { RpgShapeButton } from "../../../shared/ui/primitives/RpgShapeButton";
import eventDetail from "../../../assets/tutorial/event-detail.png";
import handDetail from "../../../assets/tutorial/hand-detail.png";
import handPreview from "../../../assets/tutorial/hand-preview.png";
import factorDetail from "../../../assets/tutorial/factor-detail.png";
import battleInterface from "../../../assets/tutorial/intents.jpg";
import "../../../shared/ui/styles/items.css";
import "../tutorial-overview.css";

export { copy as handbookCopy };
export type HandbookPage = { chapter: number; section: number };
type FigureId = keyof typeof copy.figures;
type KeyRule = {title?: string; text: string};
type TableContent = {
  title: string; columns?: string[]; rows?: string[][]; table?: string;
  tableTitle?: string; rowIcons?: string[]; itemIcons?: string[];
};
type Topic = TableContent & {
  paragraphs?: string[]; keyRules?: KeyRule[]; note?: string; figure?: string; figureLayout?: string;
};
type Section = TableContent & {
  id: string; summary?: string; paragraphs?: string[]; figure?: string;
  steps?: string[][]; stepsTitle?: string; rulesTitle?: string; table?: string; formula?: string; note?: string; practice: string;
  keyRules?: KeyRule[];
  timeline?: string[];
  topics?: Topic[];
  explanation?: {title: string; lead: string; points: string[]; closing?: string; figure?: string};
  readingGroups?: {id: string; title: string; purpose: string; items: {mark: number; term: string; text: string}[]}[];
  links?: {chapter: string; section: string; label: string}[];
  interfaceOverview?: {
    caption: string; regions: {id: string; title: string; text: string}[];
    controlsCaption: string; controlsLabels: string[]; flowTitle: string;
    walkthrough: {title: string; paragraphs: string[]; figure?: string; caption?: string}[];
  };
};

function Mark({n, x, y}: {n: number; x: number; y: number}) {
  return <b className="handbook__mark" style={{left: `${x}%`, top: `${y}%`} as CSSProperties} aria-hidden="true">{n}</b>;
}

// Pixel bounds in the verified 1600 × 900 battle capture; labels stay in runtime copy.
const interfaceRegions = [
  {id: "enemies", x: 254, y: 130, width: 811, height: 282, markerX: 272, markerY: 146},
  {id: "party", x: 254, y: 420, width: 811, height: 218, markerX: 272, markerY: 438},
  {id: "dice", x: 268, y: 642, width: 784, height: 132, markerX: 285, markerY: 660},
  {id: "controls", x: 328, y: 784, width: 665, height: 66, markerX: 307, markerY: 817},
  {id: "sidebar", x: 1080, y: 130, width: 260, height: 718, markerX: 1097, markerY: 146},
  {id: "menu", x: 4, y: 22, width: 54, height: 410, markerX: 82, markerY: 43},
] as const;

const interfaceDetails: Record<string, string> = {
  "enemy-intent": "811 137 111 63",
  "actor-die": "300 430 282 348",
};

function HandbookInterface({content}: {content: NonNullable<Section["interfaceOverview"]>}) {
  return <div className="handbook__interface">
    <div className="handbook__interface-layout">
      <figure className="handbook__interface-map" aria-label={content.caption}>
        <div>
          <img src={battleInterface} width="1600" height="900" alt={content.caption}/>
          <svg viewBox="0 0 1600 900" aria-hidden="true">
            {interfaceRegions.map(({id, x, y, width, height}) => <rect key={id} x={x} y={y} width={width} height={height}/>)}
          </svg>
          {interfaceRegions.map(({id, markerX, markerY}, index) => <Mark key={id} n={index + 1} x={markerX / 16} y={markerY / 9}/>)}
        </div>
        <figcaption>{content.caption}</figcaption>
      </figure>
      <ol className="handbook__interface-regions" aria-label="界面区域说明">
        {content.regions.map((region, index) => <li key={region.id} data-region={region.id}>
          <span className="handbook__reading-mark" aria-hidden="true">{index + 1}</span>
          <div><h3>{region.title}</h3><p>{region.text}</p></div>
        </li>)}
      </ol>
    </div>
    <section className="handbook__interface-operation" aria-label={content.flowTitle}>
      <h3>{content.flowTitle}</h3>
      <ol className="handbook__walkthrough" aria-label={`${content.flowTitle} · 操作顺序`}>
        {content.walkthrough.map((step, index) => <li key={step.title}>
          <h4><span>{String(index + 1).padStart(2, "0")}</span>{step.title}</h4>
          <div className={step.figure && step.figure !== "controls" ? "handbook__walkthrough-illustrated" : undefined}>
            <div>{step.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
            {step.figure && interfaceDetails[step.figure] && <figure className={`handbook__walkthrough-detail handbook__walkthrough-detail--${step.figure}`}>
              <svg viewBox={interfaceDetails[step.figure]} role="img" aria-label={step.caption}>
                <image href={battleInterface} width="1600" height="900"/>
              </svg>
              <figcaption>{step.caption}</figcaption>
            </figure>}
          </div>
          {step.figure === "controls" && <figure className="handbook__interface-controls" aria-label={content.controlsCaption}>
            <svg viewBox="325 784 680 68" role="img" aria-label={content.controlsLabels.join("；")}>
              <image href={battleInterface} width="1600" height="900"/>
            </svg>
            <figcaption>{content.controlsLabels.map(label => <span key={label}>{label}</span>)}</figcaption>
          </figure>}
        </li>)}
      </ol>
    </section>
  </div>;
}

/** Same die renderer and supply art as battle; UI fragments are explicitly examples. */
function HandbookFigure({id, caption = true}: {id: FigureId; caption?: boolean}) {
  const figure = copy.figures[id];
  return <figure className={`handbook__figure handbook__figure--${id}`} aria-label={figure.caption}>
    {id === "die-anatomy" && <div className="handbook__die-diagram">
      <ExpeditionFlatDieFrame fate={2} power={1} suitShape="square" themeColor="#718e9b" label={figure.caption}/>
      <svg className="handbook__die-leaders" viewBox="0 0 100 100" aria-hidden="true"><path d="M-4 11H9 M107 50H62 M107 90H94 M90 -5V6"/></svg>
      <Mark n={1} x={-4} y={11}/><Mark n={2} x={107} y={50}/><Mark n={3} x={107} y={90}/><Mark n={4} x={90} y={-5}/>
    </div>}
    {id === "die-fates" && <div className="handbook__corner-examples handbook__corner-examples--fates">
      {[false, true].map((wild, index) => <div key={String(wild)}>
        <span className="handbook__fate-crop"><ExpeditionFlatDieFrame suitShape="diamond" fate={2} wildPip={wild} showPanel={false} label={figure.labels[index]}/></span>
        <span>{figure.labels[index]}</span>
      </div>)}
    </div>}
    {id === "die-suits" && <div className="handbook__corner-examples">
      {(["square", "diamond", "triangle", "circle"] as const).map((suit, index) => <div key={suit}>
        <span className="handbook__fate-crop"><ExpeditionFlatDieFrame suitShape={suit} fate={2} showPanel={false} label={figure.labels[index]}/></span>
        <span>{figure.labels[index]}</span>
      </div>)}
    </div>}
    {id === "die-seals" && <div className="handbook__corner-examples handbook__corner-examples--seals">
      {(["plain", "gild", "rust"] as const).map((seal, index) => <div key={seal}>
        <span className="handbook__seal-crop"><ExpeditionFlatDieFrame seal={seal} showPanel={false} label={figure.labels[index]}/></span>
        <span className="handbook__corner-label">{figure.labels[index]}<strong>{copy.figures["die-seals"].values[index]}</strong></span>
      </div>)}
    </div>}
    {id === "die-actions" && <div className="handbook__marks-row handbook__marks-row--actions">
      {(["attack", "guard", "heal", "wild", "blank", "art"] as const).map((action, index) => <div key={action}>
        <ExpeditionFlatDieFrame action={action} fate={1} power={action === "blank" || action === "art" ? 0 : 1} label={figure.labels[index]}/><span>{figure.labels[index]}</span>
      </div>)}
    </div>}
    {id === "die-power" && <div className="handbook__power-marks">
      {[1, 2, 3, 4, 5].map((power, index) => <div key={power}>
        <span className="handbook__power-crop"><ExpeditionFlatDieFrame power={power} label={figure.labels[index]}/></span>
        <span>{figure.labels[index]}</span>
      </div>)}
    </div>}
    {id === "event-detail" &&
      <div className="handbook__crop"><img src={eventDetail} alt={figure.caption} width="145" height="167"/>
      </div>
    }
    {id === "hand-detail" && <>
      <div className="handbook__hand-strip"><img src={handDetail} alt={figure.labels.slice(0, 3).join("；")} width="710" height="132"/>
        <Mark n={1} x={23} y={68}/><Mark n={2} x={50} y={68}/><Mark n={3} x={92} y={68}/>
      </div>
      <div className="handbook__hand-readouts"><img src={handPreview} alt="本轮两对预览：加成 0.3" width="132" height="46"/><span aria-hidden="true">·</span><img src={factorDetail} alt={figure.labels[3]} width="181" height="73"/>
      </div>
      <ol className="handbook__legend handbook__legend--inline">{figure.labels.slice(0, 3).map((label, index) => <li key={label}><b>{index + 1}</b><span>{label}</span></li>)}</ol>
    </>}
    {caption && <figcaption>{figure.caption}</figcaption>}
  </figure>;
}

function HandbookTable({section}: {section: TableContent}) {
  const table = section.table ? copy.tables[section.table as keyof typeof copy.tables] : section;
  if (!table?.rows || !table.columns) return null;
  return <table className={`handbook__table${section.rowIcons ? " handbook__table--actions" : ""}${section.itemIcons ? " handbook__table--items" : ""}`} aria-label={`${section.tableTitle ?? section.title} · 规则表`}>
    <thead><tr>{table.columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
    <tbody>{table.rows.map((row, rowIndex) => <tr key={row[0]}>{row.map((cell, index) => {
      const icon = section.rowIcons?.[rowIndex] as ExpeditionDieStampAction | undefined;
      const item = section.itemIcons?.[rowIndex] as keyof typeof supplyArt | undefined;
      if (item && index === 0) return <th scope="row" key={index}><span className="handbook__action-icon">
        <i aria-hidden="true" style={{maskImage: `url("${supplyArt[item].icon}")`}}/>{cell}
      </span></th>;
      if (icon && index === 0) return <td key={index}><span className="handbook__action-icon">
        <i aria-hidden="true" style={{maskImage: `url("${EXPEDITION_DIE_STAMP_ICONS[icon]}")`}}/>{cell}
      </span></td>;
      return index === (section.rowIcons ? 1 : 0) ? <th scope="row" key={index}>{cell}</th> : <td key={index}>{cell}</td>;
    })}</tr>)}</tbody>
  </table>;
}

function HandbookReadingGroups({groups}: {groups: NonNullable<Section["readingGroups"]>}) {
  return <div className="handbook__reading-groups">{groups.map(group =>
    <section className="handbook__reading-group" key={group.id} aria-label={group.title}>
      <h3>{group.title}<span>{group.purpose}</span></h3>
      <ul>{group.items.map(item => <li key={item.mark}>
        <span className="handbook__reading-mark" aria-hidden="true">{item.mark}</span>
        <p><strong>{item.term}</strong>{item.text}</p>
      </li>)}</ul>
    </section>
  )}</div>;
}

function HandbookKeyRules({rules, label}: {rules: KeyRule[]; label: string}) {
  return <ul className="handbook__key-rules" aria-label={label}>
    {rules.map(rule => <li key={rule.title ?? rule.text}>{rule.title && <strong>{rule.title}：</strong>}{rule.text}</li>)}
  </ul>;
}

/** Read-only content, no session/commands/storage. Entry and in-run help share this reader. */
export function HandbookReader({page, onPage}: {page: HandbookPage; onPage: (page: HandbookPage) => void}) {
  const uid = useId(), article = useRef<HTMLElement>(null);
  const [more, setMore] = useState(false);
  useLayoutEffect(() => {
    const node = article.current;
    if (!node) return;
    const measure = () => setMore(node.scrollHeight - node.scrollTop > node.clientHeight + 8);
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    for (const child of node.children) observer?.observe(child);
    node.addEventListener("scroll", measure);
    return () => {observer?.disconnect(); node.removeEventListener("scroll", measure);};
  }, [page.chapter, page.section]);
  const chapter = copy.chapters[page.chapter], section: Section = chapter.sections[page.section];
  const summary = section.summary ?? chapter.summary;
  const previous = page.section > 0 ? {...page, section: page.section - 1} : page.chapter > 0
    ? {chapter: page.chapter - 1, section: copy.chapters[page.chapter - 1].sections.length - 1} : null;
  const next = page.section < chapter.sections.length - 1 ? {...page, section: page.section + 1}
    : page.chapter < copy.chapters.length - 1 ? {chapter: page.chapter + 1, section: 0} : null;
  const select = (nextPage: HandbookPage) => {
    onPage(nextPage);
    if (article.current) article.current.scrollTop = 0;
  };
  const note = section.note && <aside className="handbook__note">{section.note}</aside>;
  const keyRules = section.keyRules && <>
    {section.rulesTitle && <h3 className="handbook__table-title">{section.rulesTitle}</h3>}
    <HandbookKeyRules rules={section.keyRules} label={`${section.title} · 核心规则`}/>
  </>;
  const timeline = section.timeline && <ol className="handbook__timeline" aria-label={`${section.title} · 时序`}>
    {section.timeline.map((step, index) => <li key={step}><b>{index + 1}</b><span>{step}</span>
      {index < section.timeline!.length - 1 && <span className="handbook__timeline-arrow" aria-hidden="true">→</span>}
    </li>)}
  </ol>;
  const references = section.links && <div className="handbook__references">{section.links.map(link =>
    <button type="button" key={`${link.chapter}/${link.section}`} onClick={() => {
      const chapter = copy.chapters.findIndex(item => item.id === link.chapter);
      const section = copy.chapters[chapter]?.sections.findIndex(item => item.id === link.section) ?? -1;
      if (chapter >= 0 && section >= 0) select({chapter, section});
    }}>{link.label}</button>
  )}</div>;
  return <div className="handbook" data-chapter={chapter.id} data-section={section.id}>
    <nav className="handbook__contents" aria-label={copy.ui.contents}>
      <p className="handbook__overline">FIELD MANUAL <span>01—05</span></p>
      {copy.chapters.map((item, index) => <div key={item.id} className="handbook__chapter" data-active={index === page.chapter || undefined}>
        <button type="button" aria-label={item.title} aria-current={index === page.chapter ? "true" : undefined} onClick={() => select({chapter: index, section: 0})}>
          <span className="handbook__index">0{index + 1}</span><span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
        </button>
        {index === page.chapter && <ol aria-label={`${item.title}小节`}>{item.sections.map((subsection, s) => <li key={subsection.id}>
          <button type="button" aria-current={s === page.section ? "page" : undefined} onClick={() => select({chapter: index, section: s})}>{subsection.title}</button>
        </li>)}</ol>}
      </div>)}
      <p className="handbook__scope">{copy.scope}</p>
    </nav>
    <div className="handbook__reading">
      <header className="handbook__heading">
        <span className="handbook__overline">{`0${page.chapter + 1} / ${chapter.title}`}</span>
        <h2 id={`${uid}-heading`}>{section.title}</h2>{summary && <p>{summary}</p>}
      </header>
      <article className="handbook__article" ref={article} aria-labelledby={`${uid}-heading`} tabIndex={0}>
        {section.interfaceOverview && <HandbookInterface content={section.interfaceOverview}/>}
        {section.explanation && <section className="handbook__explanation" aria-label={section.explanation.title}>
          <h3>{section.explanation.title}</h3>
          <div className="handbook__explanation-layout"><div>
            <p>{section.explanation.lead}</p>
            {section.explanation.points.length > 0 && <ul>{section.explanation.points.map(point => <li key={point}>{point}</li>)}</ul>}
            {section.explanation.closing && <p>{section.explanation.closing}</p>}
          </div>{section.explanation.figure && <HandbookFigure id={section.explanation.figure as FigureId}/>}</div>
        </section>}
        {!section.steps && keyRules}
        {section.steps && <>
          {section.stepsTitle && <h3 className="handbook__table-title">{section.stepsTitle}</h3>}
          {timeline}
          <ol className="handbook__steps">{section.steps.map(([title, description], index) =>
            <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{description}</p></div></li>
          )}</ol>
          {keyRules}
        </>}
        {section.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
        {section.formula && <p className="handbook__formula">{section.formula}</p>}
        {section.tableTitle && <h3 className="handbook__table-title">{section.tableTitle}</h3>}
        {!section.steps && timeline}
        <div className={section.figure === "die-anatomy" ? "handbook__anatomy-layout" : undefined}>
          {section.figure && <HandbookFigure id={section.figure as FigureId}/>}
          {section.figure === "die-anatomy" ? <div className="handbook__anatomy-copy">
            {section.readingGroups && <HandbookReadingGroups groups={section.readingGroups}/>}{note}{references}
          </div> : <HandbookTable section={section}/>}
        </div>
        {section.topics?.map(topic => <section className={`handbook__topic${topic.figure && topic.figureLayout !== "stacked" ? " handbook__topic--illustrated" : ""}`} aria-label={topic.title} key={topic.title}>
          <div>
            <h3>{topic.title}</h3>
            {topic.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            {topic.keyRules && <HandbookKeyRules rules={topic.keyRules} label={`${topic.title} · 核心规则`}/>}
          </div>{topic.figure && <HandbookFigure id={topic.figure as FigureId} caption={topic.figureLayout === "stacked"}/>}
          <HandbookTable section={topic}/>
          {topic.note && <aside className="handbook__note">{topic.note}</aside>}
        </section>)}
        {section.figure !== "die-anatomy" && <>{note}{references}</>}
      </article>
      <div className="handbook__scroll-hint">{more && <button type="button" onClick={() => {
        if (article.current) article.current.scrollTop += article.current.clientHeight * .75;
      }}>{copy.ui.more}</button>}</div>
      <footer className="handbook__page-footer">
        <div><span>{copy.ui.practice}</span><p>{section.practice}</p></div>
        <div className="handbook__pagination">
          <button type="button" disabled={!previous} aria-label={copy.ui.previous} onClick={() => previous && select(previous)}>←</button>
          <span>{page.section + 1} / {chapter.sections.length}</span>
          <button type="button" disabled={!next} aria-label={copy.ui.next} onClick={() => next && select(next)}>→</button>
        </div>
      </footer>
    </div>
  </div>;
}

/** Mounted while closed so chapter selection survives repeated lookup. */
export function HandbookModal({open, onClose}: {open: boolean; onClose: () => void}) {
  const [page, setPage] = useState<HandbookPage>({chapter: 0, section: 0});
  return <RpgModal open={open} onClose={onClose} title={copy.title} panelClassName="handbook-modal" className="handbook-scrim"
    header={<div className="handbook-modal__heading"><h2>{copy.title}</h2></div>}
    footer={<RpgShapeButton className="handbook-modal__return" label={copy.ui.back} variant="teal" onClick={onClose}/>}>
    <HandbookReader page={page} onPage={setPage}/>
  </RpgModal>;
}
