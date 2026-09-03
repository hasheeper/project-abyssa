import { useState } from "react";
import type { CSSProperties } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgDialogue } from "../../shared/ui/primitives/RpgDialogue";
import { Stage } from "../../shared/stage";
import { SceneTransitionProvider, useSceneTransition } from "../../shared/transition";
import { characterProfiles } from "../../content/characters/profiles";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuCommandDial } from "./MenuCommandDial";
import type { MenuCommandId } from "./MenuCommandDial";
import { MenuSceneControls } from "./MenuSceneControls";
import { MenuSidebar } from "./MenuSidebar";
import type { MenuSectionId } from "./MenuSidebar";
import { MenuTopBar } from "./MenuTopBar";
import type { MenuPhaseId } from "./MenuTopBar";

/* ============ 枢纽主界面 ============
 *
 * 三列横向排布,几何全部从 1600x900 共享画布推导,一个 px 都不写视口单位
 * (Stage 会整体 scale,vw/cqh 会与它叠成二次缩放 —— 见 stage/README.md 铁律 1):
 *
 *   pad32 | 侧栏190 | gap32 | 立绘栏518 | gap32 | 命令盘764 | pad32 = 1600
 *   顶栏 104 高,内容区 y152..868(高 716)
 *
 * 左「查阅」(图鉴/角色/…) · 中「人」(立绘 + 吐槽) · 右「去处」(府邸/出征/仓库/商店)
 * 三者是三种不同性质的入口,所以分三列而不是堆一处。
 */

const IDLE_LINE = "……今天也没什么大事吧？那就好。";

const COMMAND_LINES: Record<MenuCommandId, string> = {
  estate: "回洋馆吗？大家都在。",
  storage: "仓库的东西，我都记着数。",
  shop: "去杂货铺的话……记得别被缇比宰了。",
  sortie: "要出去了？那我去准备。"
};

const SECTION_LINES: Record<MenuSectionId, string> = {
  codex: "图鉴又添了新条目。慢慢看吧。",
  roster: "想看谁的档案？",
  memory: "有些事，记着比忘了好。",
  replay: "回头看看走过的路，也不坏。",
  achievements: "这些都是你做到的事。",
  settings: "要调什么？我等着。"
};

const MENU_HOSTS = characterProfiles.filter((profile) => profile.portraitUrl);
const DEFAULT_HOST_INDEX = Math.max(0, MENU_HOSTS.findIndex((profile) => profile.id === "abyssa"));

const MENU_HOST_LINES: Record<string, string> = {
  eustice: "值守期间，我会维持这里的秩序。",
  elora: "今晚也由我陪着你吧。",
  kororo: "需要我留在这里？可以。",
  norma: "换岗完成。周围安全。",
  abyssa: IDLE_LINE,
  marietta: "这里交给我吧，修缮也要继续。",
  alvitr: "我会暂代此处的值守。",
  lenore: "安静的地方，正适合整理记录。",
  vivienne: "今夜的大厅，也需要一点体面。"
};

const MENU_BACKGROUNDS = [
  {
    id: "manor-night-gallery",
    name: "月下长廊",
    imageUrl: manorNightGallery
  }
] as const;

const COMMAND_DESTINATIONS: Partial<
  Record<MenuCommandId, { href: string; destination: string; channel: string }>
> = {
  estate: {
    href: "./mansion.html",
    destination: "守望者之崖洋馆",
    channel: "正在返回"
  },
  shop: {
    href: "./shop.html",
    destination: "守望者杂货铺",
    channel: "正在前往"
  },
  sortie: {
    href: "./battle.html",
    destination: "裂隙远征",
    channel: "正在进入"
  }
};

/* 左栏档案入口的跳转表。与 COMMAND_DESTINATIONS 同形:未列出的条目仍是
   纯占位,点了只说话不跳页。目前只有「角色」接到了 STATUS。 */
const SECTION_DESTINATIONS: Partial<
  Record<MenuSectionId, { href: string; destination: string; channel: string }>
> = {
  roster: {
    href: "./character-status.html",
    destination: "角色档案",
    channel: "正在翻阅"
  }
};

export function MenuPage() {
  return (
    <SceneTransitionProvider>
      <MenuPageContent />
    </SceneTransitionProvider>
  );
}

function MenuPageContent() {
  const { navigate } = useSceneTransition();
  const [selectedCommand, setSelectedCommand] = useState<MenuCommandId>("estate");
  const [selectedSection, setSelectedSection] = useState<MenuSectionId | null>(null);
  const [line, setLine] = useState(IDLE_LINE);
  const [lineKey, setLineKey] = useState(0);
  const [hostIndex, setHostIndex] = useState(DEFAULT_HOST_INDEX);
  const [backgroundIndex, setBackgroundIndex] = useState(0);

  // 视觉原型阶段:资源与时间是静态样本值,不接真实存档。
  const [day] = useState(12);
  const [phase] = useState<MenuPhaseId>("dusk");
  const funds = { public: 12800, party: 1450, crystals: 8 };

  const host = MENU_HOSTS[hostIndex];
  const activeBackground = MENU_BACKGROUNDS[backgroundIndex];

  const say = (text: string) => {
    setLine(text);
    // key 递增强制 RpgDialogue 重挂,打字机才会从头走。
    setLineKey((current) => current + 1);
  };

  return (
    <Stage
      background="var(--abyssa-menu-backdrop)"
      canvasClassName="menu-stage"
      style={
        {
          "--menu-scene-image": `url("${activeBackground.imageUrl}")`
        } as CSSProperties
      }
    >
      <AbyssaProvider className="menu-app">
        <MenuBackdrop />
        <MenuTopBar
          day={day}
          phase={phase}
          publicFund={funds.public}
          partyFund={funds.party}
          crystals={funds.crystals}
        />

        <MenuSceneControls
          characterName={host?.selectorLabel ?? host?.name ?? "未配置"}
          characterIndex={hostIndex}
          characterCount={MENU_HOSTS.length}
          backgroundName={activeBackground.name}
          backgroundIndex={backgroundIndex}
          backgroundCount={MENU_BACKGROUNDS.length}
          onNextCharacter={() => {
            const nextIndex = (hostIndex + 1) % MENU_HOSTS.length;
            const nextHost = MENU_HOSTS[nextIndex];
            setHostIndex(nextIndex);
            setSelectedCommand("estate");
            setSelectedSection(null);
            say(MENU_HOST_LINES[nextHost.id] ?? "今晚由我留在这里。");
          }}
          onNextBackground={() => {
            const nextIndex = (backgroundIndex + 1) % MENU_BACKGROUNDS.length;
            setBackgroundIndex(nextIndex);
            say(
              MENU_BACKGROUNDS.length === 1
                ? "这里的夜色，暂时就这一种。"
                : `换成「${MENU_BACKGROUNDS[nextIndex].name}」吧。`
            );
          }}
        />

        <div className="menu-app__body">
          <MenuSidebar
            selectedId={selectedSection}
            onSelect={(id) => {
              /* 与命令盘同一套交互:先选中说话,再点已选中的才跳页
                 (MenuCommandDial.tsx:196 的 select-then-activate)。
                 左栏没有 onActivate,所以在这里自己判重复点击。 */
              const target = SECTION_DESTINATIONS[id];
              if (target && id === selectedSection) {
                navigate(target.href, {
                  destination: target.destination,
                  channel: target.channel
                });
                return;
              }
              setSelectedSection(id);
              say(SECTION_LINES[id]);
            }}
          />

          {/* ============ 立绘栏:破窗,无边框 ============
              **不用 RpgFrame** —— 给立绘套画框会把人物困在一个小窗里,
              读起来像贴纸而不是站在场景里。这里让立绘:
                1. 没有任何边框/画板
                2. 顶部顶到顶栏下沿、底部越过画布下留白(负 bottom)
                3. 底缘用渐变溶进背景,不留裁切线
              对话框移到右侧命令盘下方，中栏只保留人物本体。 */}
          <div className="menu-app__host">
            <div className="menu-host__glow" aria-hidden="true" />
            {host?.portraitUrl && (
              <img
                className="menu-host__figure"
                src={host.portraitUrl}
                alt={host.portraitAlt ?? `${host.name} 立绘`}
                draggable={false}
              />
            )}
            <div className="menu-host__fade" aria-hidden="true" />
          </div>

          <div className="menu-app__dial">
            <MenuCommandDial
              selectedId={selectedCommand}
              onSelect={(id) => {
                setSelectedCommand(id);
                setSelectedSection(null);
                say(COMMAND_LINES[id]);
              }}
              onActivate={(id) => {
                const target = COMMAND_DESTINATIONS[id];
                if (!target) {
                  say(`${COMMAND_LINES[id]}（仓库界面尚未接入）`);
                  return;
                }
                navigate(target.href, {
                  destination: target.destination,
                  channel: target.channel
                });
              }}
            />
            <RpgDialogue
              key={lineKey}
              className="menu-dial__dialogue"
              name={host?.selectorLabel ?? host?.name ?? ""}
              secondaryName={host?.secondaryName}
              text={line}
              showNameplate
              typing
              autoHeight
              aria-live="polite"
            />
          </div>
        </div>
      </AbyssaProvider>
    </Stage>
  );
}
