# 洋馆日志排版 · Opus 原始交付 v3

- 模型：`proxy:claude-opus-5-5 [perplexity]`
- 咨询：`c-74193d1b-769e-4781-9e34-c8550a15fd9c`
- 回答：`t-a60ca60b-2c86-4c2b-a4cb-1d381c960528`
- 父版：`t-ad631a90-88d5-40d3-8268-2054c6e2fe70`（v2 在代码中截断）
- 本版完整返回，以下内容按模型原文保留，不代表用户已验收。
- 主 Agent 的状态语义修正、容器查询修正及整合记录另列。

---

# 洋馆日志内页排版：完整 JSX / CSS

## 一、通用组件（加入 `JournalBrowser.tsx`）

`useId` 和 `ReactNode` 已在原文件中 import。物品名和外观允许完整折行，只有左侧目录仍单行省略。

```tsx
export function JournalLedger({label, summary, children}: {
  label: string; summary?: string; children: ReactNode;
}) {
  const id = useId();
  return <section className="journal-ledger" aria-labelledby={id}>
    <header className="journal-ledger__head">
      <h4 id={id}>{label}</h4>
      {summary && <span className="journal-ledger__summary">{summary}</span>}
    </header>
    <ul className="journal-ledger__rows">{children}</ul>
  </section>;
}

export function JournalLedgerRow({icon, name, note, quantity}: {
  icon?: string; name: string; note?: string; quantity: number;
}) {
  return <li className="journal-ledger__row">
    <span className="journal-ledger__icon" aria-hidden="true">
      {icon && <img src={icon} alt="" draggable={false} loading="lazy" decoding="async"/>}
    </span>
    <span className="journal-ledger__text">
      <span className="journal-ledger__name">{name}</span>
      {note && <span className="journal-ledger__note">{note}</span>}
    </span>
    <span className="journal-ledger__qty" data-single={quantity === 1 || undefined}>
      <span aria-hidden="true">×</span>{quantity}<span className="journal-sr-only"> 件</span>
    </span>
  </li>;
}

export type JournalStatusTone = "ready" | "pending" | "failed" | "settled";
export function JournalStatus({tone, label, note}: {
  tone: JournalStatusTone; label: string; note?: ReactNode;
}) {
  return <div className="journal-status" data-tone={tone} role="status">
    <p className="journal-status__label">{label}</p>
    {note && <p className="journal-status__note">{note}</p>}
  </div>;
}
```

## 二、待鉴定的收获

```tsx
interface PendingLootItem {
  instanceId: string; definitionId: string; unknownName: string;
  unknownIconUrl?: string; iconUrl?: string; appearance?: string; quantity: number;
}
interface PendingLootGroup {
  key: string; name: string; icon?: string; appearance?: string; quantity: number;
}

/** 只合并显示。同一 definitionId 的未鉴定名与外观一致；只读取未鉴定字段。 */
function groupPendingLoot(items: PendingLootItem[]): PendingLootGroup[] {
  const groups = new Map<string, PendingLootGroup>();
  for (const item of items) {
    const group = groups.get(item.definitionId);
    if (group) { group.quantity += item.quantity; continue; }
    groups.set(item.definitionId, {
      key: item.definitionId,
      name: item.unknownName,
      icon: item.unknownIconUrl ?? item.iconUrl,
      appearance: item.appearance,
      quantity: item.quantity,
    });
  }
  return [...groups.values()];
}

export function PendingLootRecord({items, appraisalHref}: {
  items: PendingLootItem[]; appraisalHref: string;
}) {
  const groups = groupPendingLoot(items);
  const total = groups.reduce((sum, g) => sum + g.quantity, 0);
  const summary = groups.length > 1 ? `${groups.length} 种 · 共 ${total} 件` : `共 ${total} 件`;
  return <>
    <JournalRecordHeading title="待鉴定的收获" meta="带回物品 · 由你保管"/>
    <p>缇比或许认得它们。先请她看看是什么，再决定出售还是留下。</p>
    <div className="journal-record__actions">
      <JournalActionLink href={appraisalHref} emphasis="primary">去杂货铺鉴定</JournalActionLink>
      <span className="journal-record__aside">不急，东西会一直收在这里。</span>
    </div>
    <JournalLedger label="尚未鉴定" summary={summary}>
      {groups.map(g => <JournalLedgerRow key={g.key} icon={g.icon}
        name={g.name} note={g.appearance} quantity={g.quantity}/>)}
    </JournalLedger>
  </>;
}
```

## 三、今日安排

条目只展示日期、安排状态和一个打开弹窗的按钮，不读取任何事件内容，所以未发布剧情不会出现在这里。

```tsx
type ScheduleState = "ready" | "preparing" | "failed" | "settled";

/** 由主 Agent 按真实状态映射；未知状态请回落到 preparing。 */
export function toScheduleState(status: string): ScheduleState {
  switch (status) {
    case "准备就绪": return "ready";
    case "本次未完成": return "failed";
    case "今日安排已落定": return "settled";
    default: return "preparing";
  }
}

const SCHEDULE_COPY: Record<ScheduleState, {tone: JournalStatusTone; label: string; note: string}> = {
  ready:     {tone: "ready",   label: "今日安排已备好",   note: "可以先看一看，再决定是否接纳。"},
  preparing: {tone: "pending", label: "正在准备今日安排", note: "稍候片刻，你可以先去处理别的事。"},
  failed:    {tone: "failed",  label: "这次没能备好安排", note: "打开后可查看情况。"},
  settled:   {tone: "settled", label: "今日安排已落定",   note: "今天的事会依次到来。"},
};

export function DailyScheduleRecord({day, state, onOpen}: {
  day: number; state: ScheduleState; onOpen: () => void;
}) {
  const copy = SCHEDULE_COPY[state];
  return <>
    <JournalRecordHeading title="今日安排" meta={`第 ${day} 日 · 洋馆日程`}/>
    <JournalStatus tone={copy.tone} label={copy.label} note={copy.note}/>
    <div className="journal-record__actions">
      <JournalButton emphasis={state === "ready" ? "primary" : "normal"} onClick={onOpen}>
        查看今日安排
      </JournalButton>
    </div>
  </>;
}
```

## 四、CSS：替换 `journal-browser.css`

```css
/* Journal geometry; color roles come from the shared manor utility palette. */
.campaign-journal__page--browser { overflow: hidden; padding: 0; scrollbar-gutter: auto; }
.journal-browser {
  container: journal / inline-size;
  display: grid;
  grid-template-columns: 302px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}

/* ---------- Index: 64px rows, same geometry for every state ---------- */
.journal-browser__index { overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 12px; border: 1px solid var(--manor-edge); background: transparent; box-shadow: inset 0 1px rgb(255 255 255 / 4%), inset 0 -1px rgb(0 0 0 / 24%); }
.journal-browser__entries { display: grid; gap: 2px; list-style: none; margin: 0; padding: 0; }
.journal-browser__entries > li { min-width: 0; margin: 0; padding: 0; }
.journal-browser__entries button { position: relative; display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 12px; width: 100%; height: 64px; padding: 10px 12px; box-sizing: border-box; border: 1px solid transparent; border-left-width: 2px; background: transparent; color: var(--abyssa-text-soft); text-align: left; font: inherit; cursor: pointer; transition: background-color 140ms, border-color 140ms, color 140ms, box-shadow 140ms; }
.journal-browser__entries button > img { width: 22px; height: 22px; object-fit: contain; opacity: .65; }
.journal-browser__entries button > span { min-width: 0; }
.journal-browser__entries strong, .journal-browser__entries small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.journal-browser__entries strong { font-size: 16px; font-weight: 500; line-height: 22px; }
.journal-browser__entries small { margin-top: 2px; font-size: 12px; line-height: 18px; color: var(--abyssa-text-muted); }
.journal-browser__entries button:hover { background: rgb(255 255 255 / 3%); border-color: var(--journal-line); color: var(--abyssa-text); }
.journal-browser__entries button[aria-current="true"] { background: var(--manor-well); border-color: var(--manor-gold-shadow); border-left-color: var(--manor-gold); color: var(--manor-title); box-shadow: inset 0 1px rgb(206 191 146 / 12%), inset 0 -2px rgb(0 0 0 / 34%); }
.journal-browser__entries button:active { box-shadow: inset 0 1px 3px var(--abyssa-frame-deep); }
.journal-browser__entries button[aria-current="true"] img { opacity: 1; }
.journal-browser__entries button:focus-visible { outline: 1px solid var(--abyssa-focus); outline-offset: -3px; }
.journal-browser__entries button[data-locked] { color: var(--abyssa-text-muted); }
.journal-browser__entries button[data-locked] small { opacity: .75; }
.journal-browser__entries button[data-locked] img { opacity: .3; }
.journal-browser__entries button[data-locked]:hover { color: var(--abyssa-text-soft); }
.journal-browser__entries button[data-locked][aria-current="true"] { border-color: var(--journal-line); border-left-color: var(--abyssa-ornament); background: var(--abyssa-panel-dark); color: var(--abyssa-text-soft); box-shadow: inset 0 1px var(--journal-line-faint), inset 0 -1px var(--abyssa-frame-dark); }
.journal-browser__index-empty { padding-left: 14px; color: var(--abyssa-text-muted); font-size: 14px; }
.journal-browser__tools { margin: 22px 16px 0; font-size: 12px; }
.journal-browser__tools summary { font-size: 12px; }
.journal-browser__tools .airp-online input { width: 100%; min-width: 0; box-sizing: border-box; }
.journal-browser__tools .airp-online { overflow-wrap: anywhere; }

/* ---------- Reader ---------- */
.journal-browser__reader { container: reader / inline-size; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; min-width: 0; padding: 14px 12px 32px 36px; }
.journal-browser__reader:focus { outline: none; }
.journal-browser__reader:focus-visible { box-shadow: inset 2px 0 var(--abyssa-ornament-light); }
.journal-browser__reading { max-width: 34em; }

/* Heading: meta → 22px title → hairline */
.journal-record__heading { padding-bottom: 14px; margin-bottom: 18px; border-bottom: 1px solid var(--journal-line); }
.journal-record__title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
.journal-record__title-row > h3 { min-width: 0; overflow-wrap: anywhere; }
.campaign-journal .journal-record__meta { margin: 0 0 6px; color: var(--abyssa-text-muted); font-size: 12px; line-height: 18px; letter-spacing: .08em; }
.campaign-journal .journal-record__heading h3 { margin: 0; color: var(--manor-title); font-size: 22px; font-weight: 500; letter-spacing: .05em; line-height: 1.4; }

/* Body copy */
.journal-browser__reading p { margin: 0 0 .8em; font-size: 15px; line-height: 1.85; color: var(--abyssa-text-soft); }
.journal-browser__reading .campaign-journal__note { font-size: 13px; }

/* Action row: directly after the lead text, before any list */
.journal-record__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 20px; }
.journal-record__aside { color: var(--abyssa-text-muted); font-size: 13px; line-height: 1.6; }

/* ---------- Ledger: rows separated by hairlines, no cards ---------- */
.journal-ledger { margin-top: 32px; }
.journal-ledger__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--journal-line); }
.journal-ledger__head h4 { margin: 0; color: var(--abyssa-text-muted); font-size: 13px; font-weight: 500; letter-spacing: .1em; line-height: 20px; }
.journal-ledger__summary { flex: none; color: var(--abyssa-text-muted); font-size: 12px; line-height: 20px; font-variant-numeric: tabular-nums; }
.journal-ledger__rows { list-style: none; margin: 0; padding: 0; }
.journal-ledger__row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) minmax(3.5em, auto);
  align-items: start;
  column-gap: 14px;
  min-height: 56px;
  padding: 10px 0;
  box-sizing: border-box;
  border-bottom: 1px solid var(--journal-line-faint);
}
.journal-ledger__icon { display: grid; place-items: center; width: 36px; height: 36px; background: var(--manor-well); box-shadow: inset 0 0 0 1px var(--manor-hair); }
.journal-ledger__icon img { width: 28px; height: 28px; object-fit: contain; }
/* 7px = (36 icon − 22 line) / 2: a single-line name centers on the icon;
   longer names simply continue downward. */
.journal-ledger__text { display: grid; gap: 2px; min-width: 0; padding-top: 7px; }
.journal-ledger__name { color: var(--manor-body); font-size: 15px; font-weight: 500; line-height: 22px; overflow-wrap: anywhere; }
.journal-ledger__note { color: var(--abyssa-text-muted); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.journal-ledger__qty { padding-top: 7px; color: var(--manor-gold); font-size: 15px; line-height: 22px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.journal-ledger__qty > span[aria-hidden] { margin-right: .15em; opacity: .7; font-size: 13px; }
.journal-ledger__qty[data-single] { color: var(--abyssa-text-muted); }

/* ---------- Status line: diamond marker + label + note ---------- */
.journal-status { margin: 4px 0 0; }
.journal-browser__reading .journal-status__label { display: flex; align-items: center; gap: 10px; margin: 0; color: var(--manor-title); font-size: 18px; font-weight: 500; line-height: 1.5; letter-spacing: .03em; }
.journal-status__label::before { content: ""; flex: none; width: 6px; height: 6px; transform: rotate(45deg); background: var(--manor-gold-bright); }
.journal-browser__reading .journal-status__note { margin: 4px 0 0; padding-left: 16px; color: var(--abyssa-text-muted); font-size: 14px; line-height: 1.8; }
.journal-status[data-tone="pending"] .journal-status__label { color: var(--manor-body); }
.journal-status[data-tone="pending"] .journal-status__label::before { background: transparent; box-shadow: inset 0 0 0 1px var(--manor-muted); animation: journal-status-breathe 1.8s ease-in-out infinite; }
.journal-status[data-tone="failed"] .journal-status__label { color: var(--manor-body); }
.journal-status[data-tone="failed"] .journal-status__label::before { background: transparent; box-shadow: inset 0 0 0 1px var(--manor-dim); }
.journal-status[data-tone="settled"] .journal-status__label::before { background: var(--manor-gold); }
@keyframes journal-status-breathe { 50% { opacity: .35; } }
@media (prefers-reduced-motion: reduce) { .journal-status__label::before { animation: none !important; } }

/* ---------- Existing secondary blocks ---------- */
.journal-record__history { margin-top: 32px; border-top: 1px solid var(--journal-line-faint); }
.journal-record__history summary { font-size: 14px; }
.journal-record__history > details { margin: 0; padding-left: 12px; }
.journal-browser__reading .campaign-journal__empty { align-content: start; justify-items: start; text-align: left; min-height: 0; padding-top: 10px; }
.journal-browser__reading .campaign-journal__empty h3 { font-size: 20px; font-weight: 500; }
.journal-browser__reading .campaign-journal__empty p { max-width: 26em; margin: 12px 0 24px; }

.journal-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---------- Narrow widths (container-based, unaffected by global scale) ---------- */
@container journal (max-width: 860px) {
  .journal-browser { grid-template-columns: 248px minmax(0, 1fr); }
  .journal-browser__entries strong { font-size: 15px; }
  .journal-browser__reader { padding-left: 24px; }
}
@container journal (max-width: 620px) {
  /* Fallback only: stack index above reader, keeping the same row rhythm. */
  .journal-browser { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .journal-browser__index { max-height: 208px; }
  .journal-browser__reader { padding: 16px 8px 24px 16px; }
}
@container reader (max-width: 440px) {
  .campaign-journal .journal-record__heading h3 { font-size: 20px; }
  .journal-ledger__row { grid-template-columns: 32px minmax(0, 1fr) minmax(3em, auto); column-gap: 12px; }
  .journal-ledger__icon { width: 32px; height: 32px; }
  .journal-ledger__icon img { width: 24px; height: 24px; }
  .journal-ledger__text, .journal-ledger__qty { padding-top: 5px; }
  .journal-record__actions { flex-direction: column; align-items: flex-start; gap: 8px; }
}
```

## 五、整合注意点

1. **删除旧结构**：删掉 `.flow-launcher` 和 `FeedbackActionButton` 的用法，今日安排只用 `JournalButton`。旧的"尚未鉴定"文字也不再逐行拼接，这个状态已由明细小标题表达。
2. **信息安全**：`groupPendingLoot` 只读取 `unknownName`、`unknownIconUrl`/`iconUrl`、`appearance`、`quantity`。如果 `iconUrl` 是鉴定后的图标，请在数据投影层置空，不要让它进入这里。
3. **primary 数量**：每条记录最多一个 `primary`。今日安排只在"准备就绪"时使用 primary。按钮只调用 `onOpen`，没有 disabled 逻辑，打开后的表现由原弹窗决定。
4. **长列表**：明细区没有内部滚动，统一由 reader 滚动。行动区在列表之前，物品再多，按钮也始终在首屏。
5. **其他条目共用**：
   - 归来结算的物品可以直接复用 `JournalLedger` / `JournalLedgerRow`，已鉴定物品可显示真名。
   - 委托和回忆沿用"抬头 → 段落 → `journal-record__actions` → 附录（`journal-record__history`）"的顺序。
   - 间距统一为：抬头下 18px，行动区上 20px，附录上 32px。
6. **兼容性**：窄宽处理依赖容器查询（Chromium 105+ / 现代 WebView）。如果运行环境更旧，把三段 `@container` 改成对应宽度的 `@media`，数值不变。
