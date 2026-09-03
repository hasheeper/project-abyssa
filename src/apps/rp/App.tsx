import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { RpScene } from "../../shared/ui/patterns/RpScene";
import anticlockwiseRotationIcon from "../../assets/icons/anticlockwise-rotation.svg";
import fastForwardIcon from "../../assets/icons/fast-forward-button.svg";
import playIcon from "../../assets/icons/play-button.svg";
import openBookIcon from "../../assets/icons/items/open-book.svg";
import { Stage } from "../../shared/stage";
import { AdvStage } from "../../shared/presentation/adv/AdvStage";
import { SCENES } from "./transcript";

const background = import.meta.env.DEV
  ? "/src/assets/backgrounds/shop.png"
  : "../src/assets/backgrounds/shop.png";

/** 自动播放时每条停留多久。 */
const AUTO_MS = 2200;

/** 版式过场总时长。CSS 侧从 --rp-morph-ms 读同一个值,只有一处定义。 */
const MORPH_MS = 560;

/** 翻页 chevron:几何中心精确落在 viewBox 中心(6,6)——
    x 4.125~7.875 中点 6、y 2.25~9.75 中点 6,不靠 padding 目测。 */
function Chevron({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M4.125 2.25 L7.875 6 L4.125 9.75" fill="none" stroke="currentcolor" strokeWidth="1.4" />
    </svg>
  );
}

/** 版式切换钮的图标:「NVL」两栏 + 中缝,「ADV」满幅 + 底部文本条。
    自绘而非取 game-icons —— 那套是道具图标,没有界面版式语义的字形。
    24×24 viewBox,线宽与 mask 图标的视觉重量对齐(1.6)。 */
function LayoutIcon({ adv }: { adv: boolean }) {
  return (
    /* 加粗到 2.2/2:同排其余四个是 game-icons 的**实心填充**图标,
       线稿要达到同等视觉重量,线宽必须明显高于常规值 ——
       1.6 在 22px 的尺寸上比实心图标轻一大截,这就是"质感不统一"。
       内部细节改用实心块(fill)而不是描边线:与实心图标同语言。 */
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentcolor">
      <rect x="3" y="5" width="18" height="14" strokeWidth="2.2" />
      {adv ? (
        <>
          {/* ADV:满幅 + 底部对话条(实心) */}
          <rect x="5.8" y="13.8" width="12.4" height="3.6" fill="currentcolor" stroke="none" />
          <rect x="8" y="8" width="4.4" height="1.5" fill="currentcolor" stroke="none" opacity=".8" />
          <rect x="8" y="10.6" width="2.8" height="1.5" fill="currentcolor" stroke="none" opacity=".8" />
        </>
      ) : (
        <>
          {/* NVL:左右两栏 + 中缝消息线(实心) */}
          <path d="M8.8 5 V19 M15.2 5 V19" strokeWidth="2" />
          <rect x="10.6" y="8.4" width="2.8" height="1.5" fill="currentcolor" stroke="none" opacity=".8" />
          <rect x="10.6" y="11.4" width="2.8" height="1.5" fill="currentcolor" stroke="none" opacity=".8" />
          <rect x="10.6" y="14.4" width="1.8" height="1.5" fill="currentcolor" stroke="none" opacity=".8" />
        </>
      )}
    </svg>
  );
}

/** 推进指示三角。SVG 而非 CSS border 三角:
    后者的墨迹重心不在盒中心(三角质心在底边到顶点的 1/3 处),
    两侧朝向相反会看起来一高一低。 */
function CueCaret({ side }: { side: "start" | "end" }) {
  return (
    <svg className="rp-app__cue-caret" data-side={side} viewBox="0 0 12 12" aria-hidden="true">
      <path d={side === "start" ? "M4 3 L9 6 L4 9 Z" : "M8 3 L3 6 L8 9 Z"} fill="currentcolor" />
    </svg>
  );
}

/** 底栏工具钮:图标 + 图标下的小字标签。
    图标既可以是 game-icons 的 SVG url(走 CSS mask 染色),
    也可以直接给内联节点(自绘线稿图标),两者视觉重量对齐。 */
function ToolButton({
  icon,
  glyph,
  label,
  caption,
  pressed,
  disabled,
  hidden,
  shrink,
  onClick
}: {
  icon?: string;
  glyph?: React.ReactNode;
  label: string;
  caption: string;
  pressed?: boolean;
  disabled?: boolean;
  /** 隐藏但**保留布局占位** —— 避免同排其他钮横向跳位。 */
  hidden?: boolean;
  /** 视觉面积偏大的图标收一档(画布留白少的构图,如圆形)。 */
  shrink?: boolean;
  onClick?: () => void;
}) {
  const mask = icon
    ? { WebkitMaskImage: `url("${icon}")`, maskImage: `url("${icon}")` }
    : undefined;
  return (
    <button
      type="button"
      className="rp-app__cell rp-app__tool"
      aria-label={label}
      title={label}
      aria-pressed={hidden ? undefined : pressed}
      data-hidden={hidden || undefined}
      disabled={disabled || hidden}
      // 隐藏时退出无障碍树:占位是视觉需要,不该被读屏念出来。
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      onClick={onClick}
    >
      {glyph ? (
        <i className="rp-app__cell-main rp-app__tool-icon" data-glyph="true" aria-hidden="true">{glyph}</i>
      ) : (
        <i
          className="rp-app__cell-main rp-app__tool-icon"
          style={mask}
          data-shrink={shrink || undefined}
          aria-hidden="true"
        />
      )}
      <span className="rp-app__cell-label" aria-hidden="true">{caption}</span>
    </button>
  );
}

/** 罗马数字(1~12 够用:幕数不会超过这个量级)。 */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function App() {
  /* ============ 幕(Scene)与幕内游标 ============
     sceneIndex 当前第几幕;count 幕内已呈现几条。
     换幕 = 换数据源(名册 + 消息)并重置游标:
       · 向后翻(看过的幕)以「即时态」整幕呈现 —— 你已经读过,
         不重演打字机(playback: instant)
       · 向前翻回最新一幕,恢复离开时的进度(liveCount 记住它)
     只有最新一幕是"直播中",历史幕全部只读 —— 翻页是回看,
     不是把演出倒回去。 */
  const [sceneIndex, setSceneIndex] = useState(0);
  const [count, setCount] = useState(1);
  /** 最新一幕的直播进度。翻去历史幕时保存,翻回来时恢复。 */
  const liveCountRef = useRef(1);

  /* 直播幕 = 已推进到的**最远**一幕(不是数组末尾!)。
     幕是逐幕解锁的:演完第 N 幕,「下一幕」才亮起;跨过去之后
     第 N 幕变成历史、第 N+1 幕成为新的直播幕。
     曾把它写成 sceneTotal - 1,后果是第一幕从一开始就被判成
     "回看中" —— 顺序整个反了。接上 LLM 后,这个值由
     "已生成的最后一幕"驱动,解锁动作即"请求生成下一幕"。 */
  const [liveSceneIndex, setLiveSceneIndex] = useState(0);
  const scene = SCENES[sceneIndex];
  const sceneTotal = SCENES.length;
  const isLive = sceneIndex === liveSceneIndex;
  const [auto, setAuto] = useState(false);
  /** 查阅模式:LOG 钮开关。演出暂停,消息流统一为不压暗的历史形态。 */
  const [reading, setReading] = useState(false);
  /* 版式。用视觉小说的标准术语:
       NVL(novel)整屏文本流 —— 本项目的NVL 消息流
       ADV(adventure)立绘 + 底部对话框,一次一句
     两者共享同一个 count 游标,是同一场演出的两种呈现。 */
  const [layout, setLayout] = useState<"nvl" | "adv">("nvl");
  /** 过场方向。null = 不在过场中。 */
  const [morph, setMorph] = useState<null | "to-adv" | "to-nvl">(null);
  /** 过场的前后半程:out = 旧版式退,in = 新版式进。中点翻转。 */
  const [morphPhase, setMorphPhase] = useState<"out" | "in">("out");
  /** ADV 当前条打字机是否走完(决定点击是快进还是推进)。 */
  const [settled, setSettled] = useState(true);
  /** 快进:把 typing 关掉让 RpgDialogue 立即补全。 */
  const [skipped, setSkipped] = useState(false);
  /** 分屏挂载计次。>0 表示是"切回来"的挂载,那批消息直接呈现终态。 */
  const [mountToken, setMountToken] = useState(0);

  const sceneRef = useRef<HTMLElement>(null);
  const morphTimer = useRef<number>(0);

  const advance = useCallback(() => {
    setCount((value) => {
      const next = Math.min(value + 1, scene.messages.length);
      liveCountRef.current = next;
      return next;
    });
    setSkipped(false);
    setSettled(false);
  }, [scene.messages.length]);

  const skipToEnd = useCallback(() => {
    setCount(scene.messages.length);
    liveCountRef.current = scene.messages.length;
    setAuto(false);
    setSkipped(true);
    setSettled(true);
  }, [scene.messages.length]);

  /** REPLAY:从头重播。回到第一条,清掉自动/查阅,打字机重新开始。 */
  /** REPLAY:重播**当前幕**。在历史幕上按,也是重播这一幕 ——
      "从头"指幕头,不是整个会话头(跨幕重播交给翻页)。 */
  const restart = useCallback(() => {
    setCount(1);
    setReading(false);
    setSkipped(false);
    setSettled(false);
    // 重播要**看到**演出,所以不 hydrate:token 归零。
    setMountToken(0);
    // 重播不强制切版式 —— 在哪个版式看就在哪个版式重来。
  }, []);

  /* ============ 换幕 ============
     goToScene(i):
       · 离开直播幕时把进度存进 liveCountRef
       · 目的幕是历史幕 -> count 直接拉满(整幕即时呈现,不重演)
       · 目的幕是直播幕 -> 恢复 liveCountRef 里的进度
       · 换幕即换挂载(key 带 sceneIndex),历史幕以 hydrate 挂载
         (打字机/入场动画全部跳过 —— 回看不是重演)
       · AUTO / 查阅态一并退出:它们都属于"当前幕的播放",不跨幕 */
  const goToScene = useCallback(
    (target: number) => {
      if (target < 0 || target >= sceneTotal || target === sceneIndex || morph) return;

      /* 向前越过直播幕 = 解锁下一幕。
         只允许一步,且当前直播幕必须演完 —— 幕的推进是演出的一部分,
         不能跳。新幕从第 1 条开始正常演(不 hydrate)。 */
      if (target > liveSceneIndex) {
        const liveDone = liveCountRef.current >= SCENES[liveSceneIndex].messages.length;
        const currentDone = isLive ? count >= scene.messages.length : liveDone;
        if (target !== liveSceneIndex + 1 || !currentDone) return;
        setLiveSceneIndex(target);
        setSceneIndex(target);
        setCount(1);
        liveCountRef.current = 1;
        setAuto(false);
        setReading(false);
        setSkipped(false);
        setSettled(false);
        setMountToken(0); // 新幕要演,不是回看
        return;
      }

      // 回看 / 翻回直播幕。
      if (isLive) liveCountRef.current = count;
      setSceneIndex(target);
      const targetIsLive = target === liveSceneIndex;
      setCount(targetIsLive ? liveCountRef.current : SCENES[target].messages.length);
      setAuto(false);
      setReading(false);
      setSkipped(true);
      setSettled(true);
      // 历史幕与"翻回直播幕"都是回看性质的挂载:不重演入场。
      setMountToken((value) => value + 1);
    },
    [sceneTotal, sceneIndex, morph, isLive, count, scene.messages.length, liveSceneIndex]
  );

  /** LOG:进查阅态时关掉自动播放 —— 查阅是暂停,不能一边翻记录一边被推进。 */
  const toggleReading = useCallback(() => {
    setReading((value) => {
      const next = !value;
      if (next) setAuto(false);
      else {
        // 回演绎态:把日志滚回最新,镜头交还演出。
        requestAnimationFrame(() => {
          const log = sceneRef.current?.querySelector(".abyssa-rp__log");
          log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
        });
      }
      return next;
    });
  }, []);

  /** 版式切换:过场期间锁住推进,过场结束再换挂载。
      ADV 是「继续当前对话」,不重置游标;切过去时当前条直接呈现终态,
      不重打一遍 —— 你已经读过它了。 */
  const toggleLayout = useCallback(() => {
    if (morph) return;
    setAuto(false);
    setReading(false);
    const next = layout === "nvl" ? "adv" : "nvl";
    setMorph(next === "adv" ? "to-adv" : "to-nvl");
    setMorphPhase("out");
    window.clearTimeout(morphTimer.current);
    /* 前半程:镜头压暗推远(旧内容还在)。
       中点:换挂载 + 翻 phase,新内容在最暗处出现,不被看见"跳"。
       后半程:镜头拉回、亮度复原。 */
    morphTimer.current = window.setTimeout(() => {
      setLayout(next);
      setSkipped(true);
      setSettled(true);
      if (next === "nvl") setMountToken((value) => value + 1);
      setMorphPhase("in");
      window.clearTimeout(morphTimer.current);
      morphTimer.current = window.setTimeout(() => setMorph(null), MORPH_MS / 2);
    }, MORPH_MS / 2);
  }, [layout, morph]);

  useEffect(() => () => window.clearTimeout(morphTimer.current), []);

  useEffect(() => {
    if (!auto || reading || morph || count >= scene.messages.length) return;
    const timer = window.setTimeout(advance, AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [auto, reading, morph, count, scene.messages.length, advance]);

  const ended = count >= scene.messages.length;

  /** ADV 三段式:打字中 → 快进;已终态 → 推进。NVL 没有打字机,直接推进。 */
  const onAdvanceGesture = useCallback(() => {
    if (morph || reading) return;
    if (layout === "adv" && !settled) {
      setSkipped(true);
      setSettled(true);
      return;
    }
    if (!ended) advance();
  }, [morph, reading, layout, settled, ended, advance]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Esc 退出查阅态(视觉小说惯例)。
      if (event.key === "Escape") {
        setReading((value) => {
          if (value) {
            requestAnimationFrame(() => {
              const log = sceneRef.current?.querySelector(".abyssa-rp__log");
              log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
            });
          }
          return false;
        });
        return;
      }
      if (event.key !== " " && event.key !== "Enter") return;
      // 查阅态不推进:空格留给日志滚动。
      if (reading) return;
      // 焦点在按钮上时空格/回车是激活键,不能抢。
      const target = event.target as HTMLElement | null;
      if (target && target.closest("button")) return;
      event.preventDefault();
      onAdvanceGesture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onAdvanceGesture, reading]);

  /** AVG 标准:整个舞台都是推进热区。内部按钮(回到最新)照常工作。
      查阅态不接热区 —— 点击属于滚动与选择,不属于推进。 */
  const onStageClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) return;
      onAdvanceGesture();
    },
    [onAdvanceGesture]
  );

  const messages = useMemo(() => scene.messages.slice(0, count), [scene, count]);
  const adv = layout === "adv";

  const cueLabel = () => {
    if (morph) return "版式切换中";
    if (reading) return "查阅中 · 点击返回";
    if (!isLive) return "回看中 · 第" + ROMAN[sceneIndex] + "幕";
    if (adv && !settled) return "点击跳过";
    if (ended) return "演出终了";
    return auto ? "自动播放中" : "点击推进";
  };

  const cueDisabled = !reading && !morph && ended && (!adv || settled);
  const state = morph
    ? "morphing"
    : reading
      ? "reading"
      : ended && settled
        ? "ended"
        : auto
          ? "playing"
          : "idle";


  return (
    <Stage background="var(--abyssa-rp-backdrop)">
      <main
        className="rp-app"
        data-state={state}
        data-layout={layout}
        data-morph={morph ?? undefined}
        data-phase={morph ? morphPhase : undefined}
        style={{ "--rp-morph-ms": `${MORPH_MS}ms` } as CSSProperties}
      >
        {/* 章节名不在 chrome 里重复 —— 它以 chapter 条目的身份在消息流内。 */}
        <section
          className="rp-app__stage"
          aria-label={adv ? "ADV 对话" : "NVL 消息流"}
          ref={sceneRef}
          onClick={reading || morph ? undefined : onStageClick}
        >
          {adv ? (
            <AdvStage
              // 与 NVL 侧同则:切版式过来的挂载不重播进场。
              key={`adv-${scene.id}-${mountToken}`}
              actors={scene.actors}
              messages={messages}
              background={background}
              typing={!skipped}
              hydrate
              onTypingEnd={() => setSettled(true)}
            />
          ) : (
            <RpScene
              // key 让每次切回分屏都是一次全新挂载 —— hydrate 的
              // "出生证明"才会重新登记为当前这批消息。
              key={`rp-${scene.id}-${mountToken}`}
              actors={scene.actors}
              messages={messages}
              background={background}
              mode={reading ? "log" : "play"}
              hydrate={mountToken > 0 || !isLive}
            />
          )}
        </section>

        {/* 底部单栏:左翻页 / 中推进 / 右工具。
            全部用消息流的 chip 语言(细边 + 半透明墨底 + 小字距),
            与「▼ 回到最新」同宗 —— chrome 服从内容的轻量语言。
            幕(Scene)P3 接入,翻页先禁用占位。 */}
        <footer className="rp-app__bar">
          <nav className="rp-app__pager" aria-label="幕切换">
            <button
              type="button"
              className="rp-app__chip rp-app__chip--nav"
              disabled={sceneIndex <= 0 || !!morph}
              aria-label="上一幕"
              onClick={() => goToScene(sceneIndex - 1)}
            >
              <Chevron flip />
            </button>
            {/* 与工具钮同构的两层网格:上层幕号、下层 SCENE 标签。 */}
            <span className="rp-app__cell rp-app__scene" data-live={isLive || undefined}>
              {/* 罗马数字用拉丁字母 I/V/X 拼,不用 Unicode 码位
                  (Ⅰ U+2160)—— Cinzel 没有那个码位会回退到中文字体。 */}
              <span className="rp-app__cell-main rp-app__scene-no">
                {ROMAN[sceneIndex]}
                <em>/</em>
                {ROMAN[sceneTotal - 1]}
              </span>
              <span className="rp-app__cell-label" aria-hidden="true">SCENE</span>
            </span>

            <button
              type="button"
              className="rp-app__chip rp-app__chip--nav"
              disabled={
                sceneIndex >= sceneTotal - 1 ||
                !!morph ||
                // 在直播幕上:演完才解锁下一幕。
                (isLive && !ended)
              }
              aria-label="下一幕"
              onClick={() => goToScene(sceneIndex + 1)}
            >
              <Chevron />
            </button>
          </nav>

          <button
            type="button"
            className="rp-app__cell rp-app__cue"
            onClick={reading ? toggleReading : onAdvanceGesture}
            disabled={cueDisabled}
          >
            <span className="rp-app__cue-line">
              {!reading && !morph && !ended && <CueCaret side="start" />}
              {/* 逐字盒 + flex gap 排字:letter-spacing 会在末字右侧
                  留一格空白,盒宽与字形团块不等宽,居中怎么调都偏。
                  gap 只存在于字与字之间,首尾无尾距。 */}
              <span className="rp-app__cue-word">
                {Array.from(cueLabel()).map((char, i) => (
                  <span key={i}>{char}</span>
                ))}
              </span>
              {!reading && !morph && !ended && <CueCaret side="end" />}
            </span>
          </button>

          <nav className="rp-app__tools" aria-label="演出控制">
            {/* ============ 排序:越常用越靠右 ============
                右端离中央的推进热区最近,留给操作最频繁的钮。

                  ADV/NVL  切版式        改变呈现方式,最少用
                  REPLAY   从头重播      重置进度,最少用且误触代价高
                  LOG      查阅记录      读历史,与播放互斥
                  AUTO     自动播放      演出进行中常用
                  SKIP     跳至终幕      与推进手势同侧,最靠右

                前两个都会**重置当前呈现**(一个重置版式、一个重置进度),
                所以并列在最左、远离热区。
                间隔全排统一(见 app.css 的 gap),不做分组 ——
                五个钮本来就在同一层级,分组间距会读成"这是两套东西"。 */}
            <ToolButton
              glyph={<LayoutIcon adv={!adv} />}
              label={adv ? "切到 NVL 版式" : "切到 ADV 版式"}
              caption={adv ? "NVL" : "ADV"}
              pressed={adv}
              disabled={!!morph}
              onClick={toggleLayout}
            />
            <ToolButton
              icon={anticlockwiseRotationIcon}
              label="从头重播"
              caption="REPLAY"
              // 圆形构图顶满画布,视觉上比同排的三角/双箭头大一圈。
              shrink
              disabled={!!morph || count <= 1}
              onClick={restart}
            />
            {/* LOG 只属于 NVL:它查的是消息流,ADV 里没有消息流。 */}
            <ToolButton
              icon={openBookIcon}
              label="查阅记录"
              caption="LOG"
              pressed={reading}
              disabled={!!morph}
              onClick={toggleReading}
              hidden={adv}
            />
            {/* AUTO / SKIP 在 ADV 下语义与打字机推进重叠,隐藏。
                但必须**保留占位**(visibility 而非 display):
                否则切版式时工具区从 5 格塌成 2 格,左侧的钮会横向
                跳一大截 —— 过场辛苦做出的同步感会被这一跳抵消。 */}
            <ToolButton
              icon={playIcon}
              label="自动播放"
              caption="AUTO"
              pressed={auto}
              disabled={ended || reading || !!morph}
              onClick={() => setAuto((value) => !value)}
              hidden={adv}
            />
            <ToolButton
              icon={fastForwardIcon}
              label="跳至终幕"
              caption="SKIP"
              disabled={ended || reading || !!morph}
              onClick={skipToEnd}
              hidden={adv}
            />
          </nav>
        </footer>
      </main>
    </Stage>
  );
}
