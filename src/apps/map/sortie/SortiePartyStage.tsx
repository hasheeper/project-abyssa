import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import { partyFigureStyle } from "./party-figure";
import { SORTIE_SLOT_COUNT } from "./sortie-model";
import type { SortieLeader, SortieMember, SortieParty } from "./sortie-model";

/* ============ 队伍立绘 ============
 *
 * 一组立绘，两种姿态，同一棵 DOM：
 *   地图态  —— 在左下角横向展开，整组可点，点开配队；
 *   委托态  —— 放大并在侧板对侧集结，人物朝向侧板；点人物进入配队。
 * 人物都是卡纸立牌（与名单牌顶的立牌是同一枚），动作也只有一套：
 *   换地方 —— 配队时整组下台（offstage），依次沉到画框下沿后面，人物换到名单牌上；
 *             编完再从画框下沿依次弹起、晃两下站稳（rising），与牌顶立牌入队同一个动作。
 *             下台不挪站位：从委托进来的，编完就在委托旁原地弹起。
 *   挪位置 —— 地图与委托之间是连续平移，不弹，同一枚立牌在桌上滑过去。
 *
 * 为什么不做成两个组件：两态之间是连续过渡（transform 补间），
 * 换组件会让 React 卸载重建，立绘闪一下，过渡就没了。
 * 姿态差异全部交给 CSS 的 [data-mode]。
 *
 * DOM 槽位恒为 SORTIE_SLOT_COUNT + 1（玩家第五席），保证切换不重建。
 * 空槽不参与站位，避免一人队伍和第五席之间被三个空槽撑开。 */

export interface SortiePartyStageProps {
  mode: "map" | "pop";
  /** 配队时下台：整组沉出画面、不接管指针，也不进无障碍树（名单牌上有同名的人）。 */
  offstage?: boolean;
  /** 委托侧板所在侧；pop 态的队伍会自动站到反侧。 */
  questSide?: "left" | "right";
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  inert?: boolean;
  onOpen: () => void;
}

type ExternalLineupStyle = CSSProperties & {
  "--sortie-map-left": string;
  "--sortie-pop-left": string;
  "--sortie-lineup-index": number;
};

/* 上台：等名单开始收起，再从左到右依次弹起。时值交给 CSS 变量，
   样式表与下面收起 rising 的计时器读同一组数。 */
const STAGE_RISE = { wait: 140, step: 80, pop: 900 } as const;
const STAGE_RISE_MS = STAGE_RISE.wait + STAGE_RISE.step * SORTIE_SLOT_COUNT + STAGE_RISE.pop;
const STAGE_RISE_STYLE = {
  "--sortie-rise-wait": `${STAGE_RISE.wait}ms`,
  "--sortie-rise-step": `${STAGE_RISE.step}ms`,
  "--sortie-rise-pop": `${STAGE_RISE.pop}ms`
} as CSSProperties;

const EXTERNAL_LINEUP = {
  map: { start: 22, step: 104 },
  pop: { start: 43, step: 132 }
} as const;

/** 外层两种队形共用同一个连续序号，只改变展开尺度；下台、上台的先后也按它排。 */
function externalLineupStyle(index: number, popIndex = index): ExternalLineupStyle {
  return {
    "--sortie-map-left": `${EXTERNAL_LINEUP.map.start + index * EXTERNAL_LINEUP.map.step}px`,
    "--sortie-pop-left": `${EXTERNAL_LINEUP.pop.start + popIndex * EXTERNAL_LINEUP.pop.step}px`,
    "--sortie-lineup-index": index
  };
}

export function SortiePartyStage({
  mode,
  offstage = false,
  questSide,
  roster,
  leader,
  party,
  inert = false,
  onOpen
}: SortiePartyStageProps) {
  const { reduced } = useUiMotion();
  /* 只有「下台 → 上台」才弹：在布局阶段同步挂上 rising，人物不会先在原位闪一帧。 */
  const [rising, setRising] = useState(false);
  const wasOffstage = useRef(offstage);
  useLayoutEffect(() => {
    if (wasOffstage.current === offstage) return;
    wasOffstage.current = offstage;
    setRising(!offstage && !reduced);
  }, [offstage, reduced]);
  useEffect(() => {
    if (!rising) return;
    const timer = window.setTimeout(() => setRising(false), STAGE_RISE_MS);
    return () => window.clearTimeout(timer);
  }, [rising]);

  const map = mode === "map";
  const pop = mode === "pop";
  const slots = Array.from({ length: SORTIE_SLOT_COUNT }, (_, index) => {
    const id = party.memberIds[index];
    return id ? roster.find((member) => member.id === id) : undefined;
  });
  let nextLineupIndex = 0;
  const positionedSlots = slots.map((member) => ({
    member,
    lineupIndex: member ? nextLineupIndex++ : null
  }));
  const activeMemberCount = nextLineupIndex;
  const enlisted = party.command === "personal";
  /* 预备出征从队首向后排：无论实际出战人数是否满员，最前一人始终占
     最前席。玩家亲征时算在队伍人数内；地图态完全不受影响。 */
  const popLineupStart = pop
    ? SORTIE_SLOT_COUNT + 1 - activeMemberCount - (enlisted ? 1 : 0)
    : 0;

  return (
    <div
      className="abyssa-sortie-stage"
      inert={inert || offstage}
      aria-hidden={offstage || undefined}
      data-mode={mode}
      data-offstage={offstage || undefined}
      data-rising={rising || undefined}
      data-quest-side={pop ? questSide : undefined}
      data-party-size={activeMemberCount}
      data-leader-enlisted={enlisted || undefined}
      style={STAGE_RISE_STYLE}
      /* 地图态整组是大按钮；委托态交还给单个人物。
         委托态不把 780x290 的透明区域做成命中盒，空白处仍可点暗幕关闭。 */
      role={map ? "button" : undefined}
      tabIndex={map ? 0 : undefined}
      aria-label={map ? "查看出战队伍并编队" : "出战队伍"}
      onClick={map ? onOpen : undefined}
      onKeyDown={
        map
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      <span className="abyssa-sortie-stage__ground" aria-hidden="true" />

      <ul className="abyssa-sortie-stage__slots">
        {positionedSlots.map(({ member, lineupIndex }, index) => (
          <li
            className="abyssa-sortie-stage__slot"
            key={member?.id ?? `empty-${index}`}
            data-empty={member ? undefined : true}
            data-lineup-index={lineupIndex ?? undefined}
            style={
              lineupIndex === null
                ? undefined
                : externalLineupStyle(lineupIndex, lineupIndex + popLineupStart)
            }
          >
            {member ? (
              <button
                className="abyssa-sortie-figure"
                type="button"
                data-art={member.figureUrl ? "figure" : "portrait"}
                data-faction={member.faction}
                disabled={map}
                aria-label={pop ? `${member.name}，点击调整队伍` : member.name}
                onClick={(event) => {
                  event.stopPropagation();
                  if (pop) onOpen();
                }}
              >
                <span className="abyssa-sortie-figure__art">
                  {(member.figureUrl ?? member.portraitUrl) && (
                    <img
                      src={member.figureUrl ?? member.portraitUrl}
                      alt=""
                      style={member.figureUrl ? partyFigureStyle(member.id) : undefined}
                    />
                  )}
                </span>
              </button>
            ) : (
              <span className="abyssa-sortie-figure" data-empty="true" aria-hidden="true">
                <span className="abyssa-sortie-figure__art" />
              </span>
            )}
          </li>
        ))}

        {/* 玩家第五席：不占四个可选槽，托管时仍在台上但退到暗处。 */}
        <li
          className="abyssa-sortie-stage__slot"
          data-leader="true"
          data-lineup-index={activeMemberCount}
          data-stowed={enlisted ? undefined : true}
          aria-hidden={pop && !enlisted ? true : undefined}
          style={externalLineupStyle(activeMemberCount, activeMemberCount + popLineupStart)}
        >
          <button
            className="abyssa-sortie-figure"
            type="button"
            data-art={leader.figureUrl ? "figure" : "portrait"}
            data-leader="true"
            data-enlisted={enlisted || undefined}
            disabled={map}
            aria-label={pop ? `${leader.name}，点击调整队伍` : leader.name}
            onClick={(event) => {
              event.stopPropagation();
              if (pop) onOpen();
            }}
          >
            <span className="abyssa-sortie-figure__art">
              {(leader.figureUrl ?? leader.portraitUrl) && (
                <img
                  src={leader.figureUrl ?? leader.portraitUrl}
                  alt=""
                  style={leader.figureUrl ? partyFigureStyle(leader.id) : undefined}
                />
              )}
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}
