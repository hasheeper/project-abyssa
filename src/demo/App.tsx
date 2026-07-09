import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AbyssaProvider,
  ArrowButton,
  CharacterSelector,
  CharacterStatusScreen,
  IconButton,
  Nameplate,
  Progress,
  RibbonButton,
  RpgFrame,
  RpgHeader,
  RpgHexButton,
  RpgPanel,
  RpgSquarePanel,
  StatusPanel,
  Toggle
} from "../index";
import { demoCharacters } from "./data";

type CategoryId = "structure" | "actions" | "display" | "compositions";

interface CatalogItem {
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  tags: string[];
  code: string;
  preview: ReactNode;
  wide?: boolean;
}

const categories: Array<{ id: CategoryId; label: string; description: string }> = [
  { id: "structure", label: "结构", description: "页面骨架与标题" },
  { id: "actions", label: "操作", description: "按钮与输入控件" },
  { id: "display", label: "数据展示", description: "状态与选择内容" },
  { id: "compositions", label: "组合范例", description: "可拆解的业务组合" }
];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="3" cy="7" r=".8" fill="currentColor" />
      <circle cx="3" cy="12" r=".8" fill="currentColor" />
      <circle cx="3" cy="17" r=".8" fill="currentColor" />
    </svg>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="demo-copy" type="button" onClick={copy}>
      {copied ? "已复制" : "复制代码"}
    </button>
  );
}

function ComponentCard({ item }: { item: CatalogItem }) {
  return (
    <article className="demo-component" id={item.id} data-wide={item.wide || undefined}>
      <header className="demo-component__header">
        <div>
          <div className="demo-component__eyebrow">
            <span>COMPONENT</span>
            {item.tags.map((tag) => <code key={tag}>{tag}</code>)}
          </div>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
        </div>
        <a href={`#${item.id}`} aria-label={`定位 ${item.name}`}>#</a>
      </header>

      <div className="demo-component__body">
        <div className="demo-preview" data-wide={item.wide || undefined}>
          <span className="demo-preview__label">INTERACTIVE PREVIEW</span>
          <div className="demo-preview__content">{item.preview}</div>
        </div>

        <div className="demo-code">
          <div className="demo-code__bar">
            <span>最小调用</span>
            <CopyButton value={item.code} />
          </div>
          <pre><code>{item.code}</code></pre>
        </div>
      </div>
    </article>
  );
}

export function App() {
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [selectedPanel, setSelectedPanel] = useState("02");
  const [selectedSquarePanel, setSelectedSquarePanel] = useState("04");

  const items: CatalogItem[] = useMemo(() => [
    {
      id: "rpg-header",
      name: "RpgHeader",
      category: "structure",
      description: "章节级标题。保持 660 × 116 的原始比例，不应通过固定高度压缩。",
      tags: ["variant", "label"],
      code: `<RpgHeader\n  label="CHARACTER STATUS"\n  variant="dark"\n/>`,
      preview: (
        <div className="demo-stack demo-stack--headers">
          <RpgHeader label="CHARACTER STATUS" variant="dark" />
          <RpgHeader label="EQUIPMENT" variant="teal" />
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-frame",
      name: "RpgFrame",
      category: "structure",
      description: "通用内容容器。用 variant、padding 和 ornamented 组合不同层级的面板。",
      tags: ["container", "padding"],
      code: `<RpgFrame variant="dark" padding="md">\n  <YourContent />\n</RpgFrame>`,
      preview: (
        <div className="demo-frame-grid">
          <RpgFrame padding="sm">Dark frame</RpgFrame>
          <RpgFrame variant="teal" padding="sm">Teal frame</RpgFrame>
          <RpgFrame variant="light" padding="sm">Light frame</RpgFrame>
        </div>
      )
    },
    {
      id: "ribbon-button",
      name: "RibbonButton",
      category: "actions",
      description: "适合扁平主操作和宽区域导航。组件按 820 × 68 等比缩放；需要更高的六边形按钮时使用 RpgHexButton。",
      tags: ["button", "loading", "selected"],
      code: `<RibbonButton\n  variant="teal"\n  onClick={handleStart}\n>\n  Start game\n</RibbonButton>`,
      preview: (
        <div className="demo-stack demo-stack--ribbons">
          <RibbonButton variant="dark" fullWidth>Dark action</RibbonButton>
          <RibbonButton variant="light" fullWidth>Light action</RibbonButton>
          <RibbonButton variant="teal" fullWidth>Primary action</RibbonButton>
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-hex-button",
      name: "RpgHexButton",
      category: "actions",
      description: "对称六边形主按钮，严格保持 920 × 120 比例。适合开始、读取、确认等高优先级操作。",
      tags: ["button", "loading", "selected"],
      code: `<RpgHexButton\n  variant="teal"\n  onClick={handleLoad}\n>\n  Load Game\n</RpgHexButton>`,
      preview: (
        <div className="demo-stack demo-stack--hex-buttons">
          <RpgHexButton variant="dark" fullWidth>New Game</RpgHexButton>
          <RpgHexButton variant="light" fullWidth>Continue</RpgHexButton>
          <RpgHexButton variant="teal" fullWidth>Load Game</RpgHexButton>
        </div>
      ),
      wide: true
    },
    {
      id: "icon-buttons",
      name: "IconButton / ArrowButton",
      category: "actions",
      description: "小面积图标操作。label 是必填的无障碍名称，ArrowButton 是方向操作的快捷封装。",
      tags: ["icon", "aria-label"],
      code: `<IconButton label="打开菜单">\n  <MenuIcon />\n</IconButton>\n\n<ArrowButton\n  label="下一项"\n  direction="right"\n/>`,
      preview: (
        <div className="demo-inline">
          <IconButton label="打开菜单"><MenuIcon /></IconButton>
          <IconButton label="亮色菜单" variant="light" shape="circle"><MenuIcon /></IconButton>
          <ArrowButton label="上一项" direction="left" variant="dark" shape="circle" />
          <ArrowButton label="下一页" direction="right" double variant="teal" shape="circle" />
        </div>
      )
    },
    {
      id: "toggle",
      name: "Toggle",
      category: "actions",
      description: "支持受控与非受控模式的二态开关，当前预览可以直接点击。",
      tags: ["controlled", "switch"],
      code: `<Toggle\n  checked={enabled}\n  onCheckedChange={setEnabled}\n  variant="teal"\n/>`,
      preview: (
        <div className="demo-inline">
          <Toggle checked={enabled} onCheckedChange={setEnabled} variant="teal" />
          <span className="demo-live-value">checked: {String(enabled)}</span>
        </div>
      )
    },
    {
      id: "progress",
      name: "Progress",
      category: "display",
      description: "显示有界数值，自动限制超出 max 的输入，并提供原生 progressbar 语义。",
      tags: ["value", "max"],
      code: `<Progress\n  label="Stability"\n  value={83}\n  showValue\n/>`,
      preview: (
        <div className="demo-stack demo-stack--progress">
          <Progress label="Stability" value={83} showValue />
          <Progress label="Resonance" value={52} variant="light" size="sm" showValue />
        </div>
      )
    },
    {
      id: "rpg-panel",
      name: "RpgPanel",
      category: "display",
      description: "正方形选择单元。适合编号、头像或自定义 children；点击下方预览可切换选中项。",
      tags: ["selectable", "6 variants"],
      code: `<RpgPanel\n  number="02"\n  selected={selected}\n  onClick={select}\n  aria-label="选择角色 02"\n/>`,
      preview: (
        <div className="demo-panel-grid">
          {(["01", "02", "03", "04", "05", "06"] as const).map((number, index) => (
            <RpgPanel
              key={number}
              number={number}
              variant={(["dark", "gray", "deep", "teal", "teal-outline", "light"] as const)[index]}
              selected={selectedPanel === number}
              onClick={() => setSelectedPanel(number)}
              aria-label={`选择 ${number}`}
            />
          ))}
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-square-panel",
      name: "RpgSquarePanel",
      category: "display",
      description: "与复杂 RpgPanel 分开的简约小方块。固定最大 116 × 116，适合紧凑选择、快捷入口和小型网格。",
      tags: ["compact", "selectable", "6 variants"],
      code: `<RpgSquarePanel\n  number="04"\n  variant="teal"\n  selected={selected}\n  onClick={select}\n  aria-label="选择 04"\n/>`,
      preview: (
        <div className="demo-square-panel-grid">
          {(["01", "02", "03", "04", "05", "06"] as const).map((number, index) => (
            <RpgSquarePanel
              key={number}
              number={number}
              variant={(["dark", "gray", "deep", "teal", "teal-outline", "light"] as const)[index]}
              selected={selectedSquarePanel === number}
              onClick={() => setSelectedSquarePanel(number)}
              aria-label={`选择小面板 ${number}`}
            />
          ))}
        </div>
      ),
      wide: true
    },
    {
      id: "nameplate",
      name: "Nameplate",
      category: "display",
      description: "独立姓名牌，可放在立绘下方，也可作为列表或详情页的身份标识。",
      tags: ["identity"],
      code: `<Nameplate\n  name="艾比希斯·贝尔泽兰"\n  secondaryName="ABYSSA BEELZERAN"\n/>`,
      preview: <Nameplate name="艾比希斯·贝尔泽兰" secondaryName="ABYSSA BEELZERAN" />
    },
    {
      id: "character-selector",
      name: "CharacterSelector",
      category: "display",
      description: "由 RpgPanel 组合的受控/非受控选择器，业务只需要传入数组和选中值。",
      tags: ["data-driven", "controlled"],
      code: `<CharacterSelector\n  items={characters}\n  value={selectedId}\n  onValueChange={setSelectedId}\n  columns={3}\n/>`,
      preview: (
        <CharacterSelector
          className="demo-selector"
          items={demoCharacters.map(({ id, number, name, selectorVariant }) => ({
            id, number, label: name, variant: selectorVariant
          }))}
          defaultValue="abyssa"
          columns={3}
        />
      )
    },
    {
      id: "status-panel",
      name: "StatusPanel",
      category: "display",
      description: "完全数据驱动的详情面板。字段、参数、特性和记录都可以按需省略。",
      tags: ["data-driven", "sections"],
      code: `<StatusPanel\n  data={{\n    title: "当代魔王",\n    subtitle: "THE VESSEL OF CHAOS",\n    fields: [{ label: "种族", value: "根源存在" }],\n    stats: [{ label: "生命", secondaryLabel: "LIFE", value: "EX" }]\n  }}\n/>`,
      preview: <StatusPanel className="demo-status" data={demoCharacters[2].status} />,
      wide: true
    },
    {
      id: "character-status-screen",
      name: "CharacterStatusScreen",
      category: "compositions",
      description: "由 Header、Frame、Selector、Nameplate、StatusPanel 和 HexButton 拼成的参考实现，不是不可拆分的大组件。",
      tags: ["composition", "data-driven"],
      code: `<CharacterStatusScreen\n  characters={characters}\n  selectedId={selectedId}\n  onSelectedIdChange={setSelectedId}\n/>`,
      preview: <CharacterStatusScreen characters={demoCharacters} defaultSelectedId="abyssa" />,
      wide: true
    }
  ], [enabled, selectedPanel, selectedSquarePanel]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => [item.name, item.description, item.category, ...item.tags]
        .join(" ").toLowerCase().includes(normalizedQuery))
    : items;

  return (
    <AbyssaProvider className="demo-app">
      <header className="demo-topbar">
        <a className="demo-brand" href="#top" aria-label="Abyssa UI 首页">
          <span>ABYSSA</span>
          <small>UI COMPONENTS</small>
        </a>
        <div className="demo-topbar__meta">
          <span>React + TypeScript</span>
          <strong>{items.length} components</strong>
        </div>
      </header>

      <div className="demo-shell" id="top">
        <aside className="demo-sidebar">
          <div className="demo-search">
            <label htmlFor="component-search">查找组件</label>
            <input
              id="component-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名称、功能或属性…"
            />
          </div>

          <nav aria-label="组件目录">
            {categories.map((category) => {
              const count = items.filter((item) => item.category === category.id).length;
              return (
                <a key={category.id} href={`#category-${category.id}`}>
                  <span>{category.label}<small>{category.description}</small></span>
                  <b>{count}</b>
                </a>
              );
            })}
          </nav>

          <div className="demo-sidebar__note">
            <strong>使用原则</strong>
            <p>先选单个组件，再按业务组合。所有交互组件均透传原生事件和 aria 属性。</p>
          </div>
        </aside>

        <main className="demo-main">
          <section className="demo-intro">
            <p>COMPONENT CATALOG · V0.1</p>
            <h1>用于拼装界面的组件目录</h1>
            <span>按功能查找、直接操作预览、复制最小调用；完整页面仅作为组合参考。</span>
          </section>

          {categories.map((category) => {
            const categoryItems = visibleItems.filter((item) => item.category === category.id);
            if (!categoryItems.length) return null;
            return (
              <section className="demo-category" id={`category-${category.id}`} key={category.id}>
                <header className="demo-category__header">
                  <div>
                    <span>{String(categories.indexOf(category) + 1).padStart(2, "0")}</span>
                    <h2>{category.label}</h2>
                  </div>
                  <p>{category.description} · {categoryItems.length} 个</p>
                </header>
                <div className="demo-catalog">
                  {categoryItems.map((item) => <ComponentCard item={item} key={item.id} />)}
                </div>
              </section>
            );
          })}

          {!visibleItems.length && (
            <div className="demo-empty">
              <strong>没有匹配的组件</strong>
              <p>换一个名称、功能或属性关键词。</p>
              <button type="button" onClick={() => setQuery("")}>清除搜索</button>
            </div>
          )}
        </main>
      </div>
    </AbyssaProvider>
  );
}
