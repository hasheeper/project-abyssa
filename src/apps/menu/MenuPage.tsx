import { activeRunId } from "../../game-client/session";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { GameProvider, GameGate, useGameSession, useGameState } from "../../game-client/react";
import { createManualSaveAttempt, type ManualSaveAttempt } from "../../game-client/manual-save";
import { SaveSlotsPanel } from "../../game-client/SaveSlotsPanel";
import { SettingsPanel } from "../../game-client/settings/SettingsPanel";
import { sameHead } from "../../game-runtime/views";
import { gameHref, recordLocator, type GamePage } from "../../game-client/navigation";
import type { CSSProperties } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { RpgDialogue } from "../../shared/ui/primitives/RpgDialogue";
import { Stage } from "../../shared/stage";
import { ArchiveOverlayScope } from "../../game-client/ArchiveFeedback";
import { SceneTransitionProvider, useSceneTransition } from "../../shared/transition";
import { characterIdentities } from "../../content/characters/identities";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { MenuBackdrop } from "./MenuBackdrop";
import { MenuCommandDial } from "./MenuCommandDial";
import type { MenuCommandId } from "./MenuCommandDial";
import { MenuSceneControls } from "./MenuSceneControls";
import { MenuSidebar } from "./MenuSidebar";
import type { MenuSectionId } from "./MenuSidebar";
import { MenuTopBar } from "./MenuTopBar";
import { MenuSystemBackdrop } from "./MenuSystemBackdrop";
import { StartingRewards } from "./StartingRewards";
import { useMenuIntro } from "./useMenuIntro";
import { useMenuParallax } from "./useMenuParallax";
import { useMenuView, type MenuView } from "./useMenuView";

/* ============ 枢纽主界面 ============
 *
 * 三列横向排布,几何全部从 1600x900 共享画布推导,一个 px 都不写视口单位
 * (Stage 会整体 scale,vw/cqh 会与它叠成二次缩放 —— 见 stage/README.md 铁律 1):
 *
 *   pad32 | 侧栏190 | gap32 | 立绘栏518 | gap32 | 命令盘764 | pad32 = 1600
 *   顶栏 104 高,内容区 y152..868(高 716)
 *
 * 左「查阅」(图鉴/成就/…) · 中「人」(立绘 + 吐槽) · 右「去处」(府邸/角色/商店/出征)
 * 三者是三种不同性质的入口,所以分三列而不是堆一处。
 */

const IDLE_LINE = "……今天也没什么大事吧？那就好。";

const COMMAND_LINES: Record<MenuCommandId, string> = {
  estate: "回洋馆吗？大家都在。",
  roster: "想看谁的档案？",
  shop: "去杂货铺的话……记得别被缇比宰了。",
  sortie: "要出去了？那我去准备。"
};

const SECTION_LINES: Record<MenuSectionId, string> = {
  codex: "图鉴又添了新条目。慢慢看吧。",
  achievements: "成就记录尚未开放。",
  memory: "有些事，记着比忘了好。",
  save: "把这一刻记下来吧。",
  load: "要从哪一段旅程继续？",
  settings: "要调什么？我等着。"
};

const MENU_HOSTS = characterIdentities.filter((profile) => profile.portraitUrl);
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

const COMMAND_DESTINATIONS:
  Record<MenuCommandId, { href: string; destination: string; channel: string }>
= {
  estate: {
    href: "./mansion.html",
    destination: "守望者之崖洋馆",
    channel: "正在返回"
  },
  roster: {
    href: "./character-status.html",
    destination: "角色档案",
    channel: "正在翻阅"
  },
  shop: {
    href: "./shop.html",
    destination: "守望者杂货铺",
    channel: "正在前往"
  },
  sortie: {
    href: "./map.html",
    destination: "裂隙远征",
    channel: "正在进入"
  }
};

export function MenuPage() {
  return (
    <SceneTransitionProvider>
      <GameProvider><GameGate><MenuPageContent /></GameGate></GameProvider>
    </SceneTransitionProvider>
  );
}

function MenuPageContent() {
  const { navigate, phase: scenePhase } = useSceneTransition();
  const intro = useMenuIntro(scenePhase);
  const session = useGameSession();
  const game = useGameState(), record = game.record!, locator = recordLocator(record);
  const view = useMenuView(intro.ref, true);
  const startingReward = useMemo(() => session.runtime.queries.startReward(record), [record, session]);
  const [operationBusy, setOperationBusy] = useState(false);
  const operationLock = useRef(false);
  const onBusyChange = useCallback((busy: boolean) => { operationLock.current = busy; setOperationBusy(busy); }, []);
  const saveAttempt = useRef<ManualSaveAttempt | null>(null);
  const lastSection = useRef<MenuView>("home");
  const contentRef = useRef<HTMLDivElement>(null);
  const home = view.displayed === "home";
  useMenuParallax(intro.ref, intro.blocked || view.target !== "home" || !home || view.transitioning);
  function openSystem(next: Exclude<MenuView, "home">) {
    if (operationLock.current || view.target === next || (next !== "settings" && game.status !== "ready")) return;
    if (next === "save" && view.displayed !== "save" && (!saveAttempt.current || saveAttempt.current.completed || !sameHead(saveAttempt.current.source.head, record.head)))
      saveAttempt.current = createManualSaveAttempt(session.runtime, record);
    lastSection.current = next;
    view.request(next);
  }
  const requestView = view.request;
  const back = useCallback(() => { if (!operationLock.current) requestView("home"); }, [requestView]);
  useEffect(() => {
    if (view.target === "home") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      event.preventDefault(); back();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [view.target, back]);
  useEffect(() => {
    if (view.transitioning || lastSection.current === "home") return;
    if (home) intro.ref.current?.querySelector<HTMLButtonElement>(`[data-section="${lastSection.current}"]`)?.focus({ preventScroll: true });
    else contentRef.current?.focus({ preventScroll: true });
  }, [view.transitioning, home, view.displayed, intro.ref]);
  const route = (href: string) => gameHref(href.replace(/^\.\//, "").replace(/\.html$/, "") as GamePage, locator);
  const [selectedCommand, setSelectedCommand] = useState<MenuCommandId>("estate");
  const [selectedSection, setSelectedSection] = useState<MenuSectionId | null>(null);
  const [line, setLine] = useState(IDLE_LINE);
  const [lineKey, setLineKey] = useState(0);
  const [hostIndex, setHostIndex] = useState(DEFAULT_HOST_INDEX);
  const [backgroundIndex, setBackgroundIndex] = useState(0);

  const { clock: { day, phase }, funds } = record.snapshot.campaign;

  const host = MENU_HOSTS[hostIndex];
  const activeBackground = MENU_BACKGROUNDS[backgroundIndex];

  const say = (text: string) => {
    setLine(text);
    // key 递增强制 RpgDialogue 重挂,打字机才会从头走。
    setLineKey((current) => current + 1);
  };

  return (
    <Stage
      background="#071011"
      canvasClassName="menu-stage"
      style={
        {
          "--menu-scene-image": `url("${activeBackground.imageUrl}")`,
        } as CSSProperties
      }
    >
      <ArchiveOverlayScope><div
        ref={intro.ref}
        className="menu-entry"
        data-menu-intro={intro.state}
        data-menu-reduced={intro.reducedMotion || undefined}
        data-menu-view={view.displayed}
        data-menu-view-phase={view.phase}
        inert={intro.blocked}
      >
      <div className="menu-scenery" aria-hidden="true" />
      <div className="menu-scenery-shade" aria-hidden="true" />
      <AbyssaProvider className="menu-app">
        {home && <div className="menu-home-backdrop" aria-hidden="true"><MenuBackdrop /></div>}
        <MenuTopBar
          day={day}
          phase={phase}
          publicFund={funds.public}
          partyFund={funds.party}
          crystals={funds.crystals}
          view={view.displayed}
          opacity={view.titleOpacity}
          titleX={view.titleX}
        />

        {home && <div className="menu-home-controls" inert={view.transitioning}>
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
        </div>}

        <div className="menu-app__body">
          <MenuSidebar
            selectedId={view.target === "home" ? selectedSection : view.target}
            archiveDisabled={game.status !== "ready"}
            disabled={operationBusy}
            onSelect={(id) => {
              if (operationLock.current) return;
              if (id === "save" || id === "load" || id === "settings") { openSystem(id); return; }
              // 图鉴、成就、记忆仍仅占位；角色从右侧四键进入原页面。
              view.request("home");
              setSelectedSection(id);
              say(SECTION_LINES[id]);
            }}
          />
          <motion.div ref={contentRef} className="menu-content"
            tabIndex={-1} inert={view.transitioning} aria-label={home ? "主菜单内容" : "菜单栏目内容"}>
          <MenuSystemBackdrop displayed={view.displayed} target={view.target} skip={view.archiveMotion.skip} />
          {home ? <div className="menu-home">
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
          </div>
          <div className="menu-host__fade" aria-hidden="true" />

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
                navigate(id === "sortie" && activeRunId(record) ? gameHref("battle", locator) : route(target.href), {
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
              text={intro.speechReady ? line : ""}
              showNameplate
              typing={!intro.reducedMotion}
              autoHeight
              aria-live="polite"
            />
          </div>
          </div> : (view.displayed === "save" && saveAttempt.current || view.displayed === "load") ? <SaveSlotsPanel
              {...view.displayed === "save" ? { mode: "save" as const, attempt: saveAttempt.current!, ready: game.status === "ready" } : { mode: "load" as const }}
              onClose={back} onBusyChange={onBusyChange}
              sceneMotion={view.archiveMotion}
              navigate={href => navigate(href, { destination: "存档进度", channel: "正在读取" })} />
            : view.displayed === "settings" ? <SettingsPanel embedded onBack={back} sceneMotion={view.settingsMotion} /> : null}
          </motion.div>
        </div>
        {startingReward && <StartingRewards key={`${record.head.saveId}:${record.head.epoch}:${startingReward.id}`}
          reward={startingReward} saveId={record.head.saveId} epoch={record.head.epoch}
          paused={intro.blocked || intro.state !== "ready" || !home || view.transitioning || view.target !== "home"}/>}
      </AbyssaProvider>
      </div></ArchiveOverlayScope>
    </Stage>
  );
}
