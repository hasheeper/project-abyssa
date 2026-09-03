import type { CSSProperties } from "react";
import {
  DEFAULT_PARTY_FIGURE_CALIBRATION,
  partyFigureCalibrations,
  type PartyFigureId
} from "../../../content/characters/partyFigureCalibration";
import { SORTIE_SLOT_COUNT } from "./sortie-model";
import type { SortieLeader, SortieMember, SortieParty } from "./sortie-model";

/* ============ 队伍立绘 ============
 *
 * 一组立绘，三种姿态，同一棵 DOM：
 *   地图态  —— 在左下角横向展开，整组可点，点开配队；
 *   配队态  —— 移到画面中上部收紧放大，单个可点（点掉即退队）。
 *   委托态  —— 放大并在侧板对侧集结，人物朝向侧板；点人物进入配队。
 *
 * 为什么不做成两个组件：两态之间是连续过渡（transform 补间），
 * 换组件会让 React 卸载重建，立绘闪一下，过渡就没了。
 * 姿态差异全部交给 CSS 的 [data-mode]。
 *
 * DOM 槽位恒为 SORTIE_SLOT_COUNT + 1（凯尔第五席），保证三态切换不重建。
 * 配队态展示空槽；地图态与委托态只让真实成员参与连续站位，避免一人队伍
 * 和第五席之间被三个空槽撑开。 */

export interface SortiePartyStageProps {
  mode: "map" | "team" | "pop";
  /** 委托侧板所在侧；pop 态的队伍会自动站到反侧。 */
  questSide?: "left" | "right";
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  onOpen: () => void;
  onRemoveMember: (memberId: string) => void;
  onToggleCommand: () => void;
}

/** 校准值以百分数存储；CSS 变量保留单位，避免组件与样式各自解释一遍。 */
function partyFigureStyle(characterId: string): CSSProperties {
  const calibration =
    partyFigureCalibrations[characterId as PartyFigureId] ??
    DEFAULT_PARTY_FIGURE_CALIBRATION;

  return {
    "--sortie-figure-scale": calibration.scale,
    "--sortie-figure-x": `${calibration.x}%`,
    "--sortie-figure-y": `${calibration.y}%`,
    "--sortie-figure-flip-x": calibration.flipX ? -1 : 1
  } as CSSProperties;
}

type ExternalLineupStyle = CSSProperties & {
  "--sortie-map-left": string;
  "--sortie-pop-left": string;
};

const EXTERNAL_LINEUP = {
  map: { start: 22, step: 104 },
  pop: { start: 43, step: 132 }
} as const;

/** 外层两种队形共用同一个连续序号，只改变展开尺度。 */
function externalLineupStyle(index: number, popIndex = index): ExternalLineupStyle {
  return {
    "--sortie-map-left": `${EXTERNAL_LINEUP.map.start + index * EXTERNAL_LINEUP.map.step}px`,
    "--sortie-pop-left": `${EXTERNAL_LINEUP.pop.start + popIndex * EXTERNAL_LINEUP.pop.step}px`
  };
}

export function SortiePartyStage({
  mode,
  questSide,
  roster,
  leader,
  party,
  onOpen,
  onRemoveMember,
  onToggleCommand
}: SortiePartyStageProps) {
  const team = mode === "team";
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
     最前席。凯尔亲征时算在队伍人数内；地图态与编队态完全不受影响。 */
  const popLineupStart = pop
    ? SORTIE_SLOT_COUNT + 1 - activeMemberCount - (enlisted ? 1 : 0)
    : 0;

  return (
    <div
      className="abyssa-sortie-stage"
      data-mode={mode}
      data-quest-side={pop ? questSide : undefined}
      data-party-size={activeMemberCount}
      data-leader-enlisted={enlisted || undefined}
      /* 地图态整组是大按钮；配队态与委托态交还给单个人物。
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
                aria-label={
                  team
                    ? `${member.name}，点击退出队伍`
                    : pop
                      ? `${member.name}，点击调整队伍`
                      : member.name
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (team) onRemoveMember(member.id);
                  else if (pop) onOpen();
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
                <span className="abyssa-sortie-figure__nm">{member.shortName}</span>
              </button>
            ) : (
              <span className="abyssa-sortie-figure" data-empty="true">
                <span className="abyssa-sortie-figure__art" aria-hidden="true" />
                <span className="abyssa-sortie-figure__nm">空位</span>
              </span>
            )}
          </li>
        ))}

        {/* 凯尔第五席：不占四个可选槽，托管时人还在台上但退到暗处。 */}
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
            aria-pressed={team ? enlisted : undefined}
            aria-label={
              team
                ? enlisted
                  ? `${leader.name}亲征，点击改为托管`
                  : `${leader.name}留守，点击改为亲征`
                : pop
                  ? `${leader.name}，点击调整队伍`
                  : leader.name
            }
            onClick={(event) => {
              event.stopPropagation();
              if (team) onToggleCommand();
              else if (pop) onOpen();
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
            <span className="abyssa-sortie-figure__nm">
              {enlisted ? `${leader.shortName} · 亲征` : "托管"}
            </span>
          </button>
        </li>
      </ul>
    </div>
  );
}
