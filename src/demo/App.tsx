import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AbyssaProvider,
  CharacterSelector,
  CharacterStatusScreen,
  IconButton,
  Nameplate,
  Progress,
  RibbonButton,
  RpgFrame,
  RpgBackButton,
  RpgCheckbox,
  RpgCircleButton,
  RpgDialogue,
  RpgDiamondNodeTrack,
  RpgHeader,
  RpgHexButton,
  RpgNotchButton,
  RpgNotchedPillButton,
  RpgPanel,
  RpgRadio,
  RpgShapeButton,
  RpgSquarePanel,
  RpgTab,
  RpgStatusNode,
  StatusPanel,
  Toggle,
  VerticalIndicator
} from "../index";
import { demoCharacters } from "./data";
import { DialogueFlowExample, SystemConfigExample } from "./CompositionExamples";

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
  { id: "compositions", label: "组合范例", description: "可直接拆解的界面流程" }
];

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
  const [selectedTab, setSelectedTab] = useState("archive");
  const [selectedRadio, setSelectedRadio] = useState("dark");
  const [checkedChoice, setCheckedChoice] = useState(true);
  const [selectedNode, setSelectedNode] = useState("center");

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
      id: "rpg-dialogue",
      name: "RpgDialogue",
      category: "structure",
      description: "1200 × 260 对话容器，姓名牌与正文分离；支持暗色、亮色外壳以及空正文状态。",
      tags: ["dialogue", "container", "2 variants"],
      code: `<RpgDialogue\n  name="Abyssa"\n  text="……太阳的光，感觉舒服的时候，就醒了。"\n/>`,
      preview: (
        <div className="demo-reference-rows demo-dialogues">
          <RpgDialogue name="Abyssa" text={"……太阳的光，感觉舒服的时候，就醒了。\n这里的阳光，味道最好。"} />
          <RpgDialogue name="name tag" variant="light" />
        </div>
      ),
      wide: true
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
      id: "rpg-shape-buttons",
      name: "RpgShapeButton / RpgCircleButton",
      category: "actions",
      description: "四类独立形状按钮：圆形、切角方形、切角横条和胶囊。几何、三层描边与底部定位点均来自参考原型。",
      tags: ["4 shapes", "button", "selected"],
      code: `<RpgShapeButton\n  label="Confirm"\n  shape="chamfer"\n  variant="teal"\n/>\n\n<RpgCircleButton label="Open" />`,
      preview: (
        <div className="demo-reference-rows">
          <div className="demo-inline">
            <RpgCircleButton label="Button" variant="dark" />
            <RpgCircleButton label="Button" variant="light" />
            <RpgCircleButton label="Button" variant="teal" />
          </div>
          <div className="demo-inline">
            <RpgShapeButton label="Button" shape="square" variant="dark" />
            <RpgShapeButton label="Button" shape="square" variant="light" />
            <RpgShapeButton label="Button" shape="square" variant="teal" />
          </div>
          <div className="demo-inline">
            <RpgShapeButton label="Button" shape="chamfer" variant="dark" />
            <RpgShapeButton label="Button" shape="chamfer" variant="light" />
            <RpgShapeButton label="Button" shape="chamfer" variant="teal" />
          </div>
          <div className="demo-inline">
            <RpgShapeButton label="Button" shape="pill" variant="dark" />
            <RpgShapeButton label="Button" shape="pill" variant="light" />
            <RpgShapeButton label="Button" shape="pill" variant="teal" />
          </div>
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-tabs",
      name: "RpgTab",
      category: "actions",
      description: "底边开放、用于连接内容面板的标签按钮。支持受控选中态和四种参考主题。",
      tags: ["tab", "controlled", "4 variants"],
      code: `<RpgTab\n  label="Archive"\n  variant="decorated"\n  selected={activeTab === "archive"}\n  onClick={() => setActiveTab("archive")}\n/>`,
      preview: (
        <div className="demo-tabs" role="tablist" aria-label="资料分类">
          {(["status", "items", "archive", "map"] as const).map((id, index) => (
            <RpgTab
              key={id}
              label={id}
              variant={(["dark", "light", "decorated", "teal"] as const)[index]}
              selected={selectedTab === id}
              onClick={() => setSelectedTab(id)}
              role="tab"
            />
          ))}
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-back-buttons",
      name: "RpgBackButton",
      category: "actions",
      description: "190 × 190 的三角返回按钮，包含完整三重轮廓、两层内饰线和定位点。",
      tags: ["back", "button", "3 variants"],
      code: `<RpgBackButton\n  label="Back"\n  variant="dark"\n  onClick={goBack}\n/>`,
      preview: (
        <div className="demo-inline">
          <RpgBackButton variant="dark" />
          <RpgBackButton variant="light" />
          <RpgBackButton variant="teal" />
        </div>
      ),
      wide: true
    },
    {
      id: "icon-buttons",
      name: "IconButton",
      category: "actions",
      description: "严格对应标准 86px 与紧凑 76px 两套图标按钮；内置关闭、增加、减少图标，并保留无障碍名称。",
      tags: ["icon", "regular", "compact"],
      code: `<IconButton\n  label="关闭"\n  icon="close"\n  shape="diamond"\n  variant="dark"\n/>\n\n<IconButton label="增加" icon="plus" size="md" />`,
      preview: (
        <div className="demo-reference-rows">
          <div className="demo-inline">
            <IconButton label="关闭" icon="close" shape="diamond" variant="dark" />
            <IconButton label="关闭" icon="close" shape="diamond" variant="light" />
            <IconButton label="关闭" icon="close" shape="diamond" variant="teal" />
          </div>
          <div className="demo-inline">
            <IconButton label="增加" icon="plus" size="md" variant="dark" />
            <IconButton label="增加" icon="plus" size="md" variant="light" />
            <IconButton label="减少" icon="minus" size="md" variant="teal" />
          </div>
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-choices",
      name: "RpgRadio / RpgCheckbox",
      category: "actions",
      description: "使用原生 radio 与 checkbox 语义，支持键盘、表单和受控状态；SVG 只负责参考稿外观。",
      tags: ["native input", "controlled", "accessible"],
      code: `<RpgRadio\n  name="theme"\n  label="暗色"\n  checked={theme === "dark"}\n  onCheckedChange={() => setTheme("dark")}\n/>\n\n<RpgCheckbox label="启用" checked={enabled} onCheckedChange={setEnabled} />`,
      preview: (
        <div className="demo-reference-rows demo-choices">
          <div className="demo-inline" role="radiogroup" aria-label="主题选择">
            {(["gray", "dark", "teal"] as const).map((variant) => (
              <RpgRadio
                key={variant}
                name="demo-theme"
                label={`${variant} 主题`}
                variant={variant}
                checked={selectedRadio === variant}
                onCheckedChange={(next) => next && setSelectedRadio(variant)}
              />
            ))}
          </div>
          <div className="demo-inline">
            <RpgCheckbox label="空白选项" variant="empty" />
            <RpgCheckbox label="暗色选项" variant="dark" checked={checkedChoice} onCheckedChange={setCheckedChoice} />
            <RpgCheckbox label="青色选项" variant="teal" defaultChecked />
          </div>
        </div>
      )
    },
    {
      id: "rpg-notch-buttons",
      name: "RpgNotchButton / RpgNotchedPillButton",
      category: "actions",
      description: "外轮廓保持完整，仅内部装饰线形成 V 形翻折。方按钮支持自定义图标，胶囊按钮用于紧凑文字操作。",
      tags: ["button", "internal notch", "3 variants"],
      code: `<RpgNotchButton label="上传" variant="teal" />\n\n<RpgNotchedPillButton label="Auto" variant="dark" />`,
      preview: (
        <div className="demo-reference-rows">
          <div className="demo-inline">
            <RpgNotchButton variant="dark" /><RpgNotchButton variant="light" /><RpgNotchButton variant="teal" />
          </div>
          <div className="demo-inline">
            <RpgNotchedPillButton label="Auto" variant="dark" /><RpgNotchedPillButton label="Auto" variant="light" /><RpgNotchedPillButton label="Auto" variant="teal" />
          </div>
        </div>
      ),
      wide: true
    },
    {
      id: "rpg-diamond-node-track",
      name: "RpgDiamondNodeTrack",
      category: "actions",
      description: "数据驱动的菱形节点选择轨道。每个节点都是真实按钮，支持受控状态、禁用项和独立标签。",
      tags: ["controlled", "data-driven", "button group"],
      code: `<RpgDiamondNodeTrack\n  items={nodes}\n  value={selectedId}\n  onValueChange={setSelectedId}\n/>`,
      preview: <RpgDiamondNodeTrack items={[{ id: "left", label: "左侧" }, { id: "center", label: "中间" }, { id: "right", label: "右侧", variant: "teal" }]} value={selectedNode} onValueChange={setSelectedNode} />
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
      id: "vertical-indicators",
      name: "VerticalIndicator",
      category: "display",
      description: "40 × 170 的纵向装饰指示条，适合侧边导航、步骤轴和面板之间的视觉连接。",
      tags: ["indicator", "ornament", "3 variants"],
      code: `<VerticalIndicator variant="teal" label="当前步骤" />`,
      preview: (
        <div className="demo-inline demo-indicators">
          <VerticalIndicator variant="dark" />
          <VerticalIndicator variant="light" />
          <VerticalIndicator variant="teal" />
        </div>
      )
    },
    {
      id: "rpg-status-nodes",
      name: "RpgStatusNode",
      category: "display",
      description: "86 × 54 紧凑状态节点，提供禁用、暗色确认和青色确认三种外观。",
      tags: ["status", "button", "3 variants"],
      code: `<RpgStatusNode\n  label="已确认"\n  icon="check"\n  variant="dark"\n/>`,
      preview: (
        <div className="demo-inline">
          <RpgStatusNode label="不可用" icon="close" variant="disabled" />
          <RpgStatusNode label="已确认" icon="check" variant="dark" />
          <RpgStatusNode label="已选中" icon="check" variant="teal" />
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
      id: "dialogue-flow-example",
      name: "DialogueFlowExample",
      category: "compositions",
      description: "可操作的对话流程：章节信息、对话进度、返回、自动播放和继续操作各自使用独立组件。",
      tags: ["composition", "dialogue flow", "interactive"],
      code: `<RpgHeader label="FIELD DIALOGUE" />\n<RpgFrame padding="none">\n  <RpgDialogue name={speaker} text={line} />\n  <RpgNotchedPillButton label="Continue" />\n</RpgFrame>`,
      preview: <DialogueFlowExample />,
      wide: true
    },
    {
      id: "system-config-example",
      name: "SystemConfigExample",
      category: "compositions",
      description: "配置页组合：标签负责分类，原生选择控件负责表单，节点轨道负责等级，主按钮只承担保存操作。",
      tags: ["composition", "settings", "form"],
      code: `<RpgTab label="General" selected />\n<RpgFrame padding="lg">\n  <Toggle checked={enabled} />\n  <RpgRadio name="theme" label="Teal" />\n  <RpgDiamondNodeTrack items={levels} />\n  <RpgHexButton>Save changes</RpgHexButton>\n</RpgFrame>`,
      preview: <SystemConfigExample />,
      wide: true
    },
    {
      id: "character-status-screen",
      name: "CharacterStatusScreen",
      category: "compositions",
      description: "角色档案流程：选择器、姓名牌和状态详情保持数据驱动；用于展示较复杂的双栏业务页面。",
      tags: ["composition", "data-driven"],
      code: `<CharacterStatusScreen\n  characters={characters}\n  selectedId={selectedId}\n  onSelectedIdChange={setSelectedId}\n/>`,
      preview: <CharacterStatusScreen characters={demoCharacters} defaultSelectedId="abyssa" />,
      wide: true
    }
  ], [checkedChoice, enabled, selectedNode, selectedPanel, selectedRadio, selectedSquarePanel, selectedTab]);

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
