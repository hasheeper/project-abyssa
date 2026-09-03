import { useState } from "react";
import type { CSSProperties } from "react";
import {
  DIE_FACE_ACTION_LABELS,
  DIE_SUIT_LABELS,
  DIE_SUIT_SHAPES,
  fateEntersHand
} from "../../../shared/domain/dice/face";
import type { DieFace } from "../../../shared/domain/dice/face";
import { ExpeditionFlatDieFrame } from "../../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import { AvatarFrame } from "../../../shared/ui/primitives/AvatarFrame";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import { RpgFacetDiamond } from "../../../shared/ui/primitives/RpgFacetDiamond";
import { RpgFrame } from "../../../shared/ui/primitives/RpgFrame";
import { getCalibration } from "../../../shared/ui/patterns/spriteCalibration";
import { SORTIE_ACTION_ICONS, maskStyle } from "./sortie-icons";
import {
  SORTIE_COMMAND_LABELS,
  SORTIE_SLOT_COUNT,
  composeParty,
  describeGamble,
  isMemberAvailable
} from "./sortie-model";
import type {
  PartyComposition,
  SortieLeader,
  SortieMember,
  SortieParty
} from "./sortie-model";

/* ============ 出战名单 ============
 *
 * 左侧海报排（横向滚动）+ 右侧信息栏（六面展开图）。
 *
 * 名单排序：已在队 → 出击资料完整 → 待补资料。三组之内保持档案原序。
 * 三组都可切换；伤势或缺骰面只会拦截最后出发。
 *
 * 信息栏的所有读数都由 composeParty / describeGamble 推导，
 * 本组件不自己数骰面 —— 规则层已经有这套聚合，重算一遍必然漂移。 */

export interface SortieRosterPanelProps {
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  onToggleMember: (memberId: string) => void;
  onClose: () => void;
}

/* 六面摊成一排，不再折成 4x3 十字。
   十字是「骰子展开图」的语汇（骰装页那种检视场景合适），
   但这里是编队时的快速比对：一排能从左到右顺次读完，
   而且省下约 120px 纵向空间留给下方读数。 */

type RosterGroup = 0 | 1 | 2;

/* 排序：已编入 → 出击资料完整 → 待补资料。
   出征的人排最前 —— 那是这一屏的答案（「我这趟带了谁」），
   不该混在候选中间等玩家去找。曾经把已入队排在第 1 组，
   四个人分散在九人里，要确认阵容得横着扫一遍。 */
function groupOf(member: SortieMember, inParty: boolean): RosterGroup {
  if (inParty) return 0;
  return isMemberAvailable(member) ? 1 : 2;
}

function SuitGlyph({ suit }: { suit: DieFace["suit"] }) {
  return (
    <i
      className="abyssa-sortie__suit"
      data-plate={DIE_SUIT_SHAPES[suit]}
      data-suit={suit}
      aria-hidden="true"
    />
  );
}

/** 战面构成一行。图标 + 数字，没有文字符号。 */
function FaceTally({ composition }: { composition: PartyComposition }) {
  const entries = [
    { action: "attack" as const, value: composition.face.attack },
    { action: "guard" as const, value: composition.face.guard },
    { action: "heal" as const, value: composition.face.heal },
    { action: "coin" as const, value: composition.face.other },
    { action: "blank" as const, value: composition.face.blank }
  ];
  return (
    <span className="abyssa-sortie__tally">
      {entries.map((entry) => (
        <span className="abyssa-sortie__tally-item" key={entry.action}>
          <i
            className="abyssa-sortie__tally-icon"
            style={maskStyle(SORTIE_ACTION_ICONS[entry.action])}
            aria-hidden="true"
          />
          <b>{entry.value}</b>
          <span className="abyssa-sortie__sr">{DIE_FACE_ACTION_LABELS[entry.action]}</span>
        </span>
      ))}
    </span>
  );
}

function SuitTally({ composition }: { composition: PartyComposition }) {
  const present = composition.suits.filter((entry) => entry.faces > 0);
  if (present.length === 0) return <span className="abyssa-sortie__muted">尚无花色</span>;
  return (
    <span className="abyssa-sortie__tally">
      {present.map((entry) => (
        <span className="abyssa-sortie__tally-item" key={entry.suit}>
          <SuitGlyph suit={entry.suit} />
          <b>{entry.faces}</b>
          <span className="abyssa-sortie__sr">{entry.label}</span>
        </span>
      ))}
    </span>
  );
}

function ConfirmPartyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5.2 12.4 4.25 4.2L18.9 7.2" />
    </svg>
  );
}

/** 六面一排。沉眠面按 seal="none" 渲染，与骰装页同一套骰面件。 */
function FaceStrip({ faces, themeColor }: { faces: readonly DieFace[]; themeColor: string }) {
  return (
    <div className="abyssa-sortie__strip">
      {faces.slice(0, 6).map((face) => {
        const awake = fateEntersHand(face.fate);
        return (
          <span
            className="abyssa-sortie__strip-cell"
            key={face.face}
            data-fate={face.fate}
            title={
              awake
                ? `第 ${face.face} 面 · ${DIE_FACE_ACTION_LABELS[face.action]} ${face.power} · 命数 ${face.pip} · ${DIE_SUIT_LABELS[face.suit]}`
                : `第 ${face.face} 面 · 沉眠`
            }
          >
            <ExpeditionFlatDieFrame
              action={face.action}
              fate={face.pip}
              power={face.power}
              seal={awake ? "plain" : "none"}
              suitShape={DIE_SUIT_SHAPES[face.suit]}
              themeColor={themeColor}
              wildPip={face.wildPip}
              scoring={awake}
              recessDepth={2}
              label=""
            />
          </span>
        );
      })}
    </div>
  );
}

/* 立绘取景沿用 RP 那套已经调好的逐角色校准（spriteCalibration），
   而不是给海报另调一份 —— 同一个人在两处大小不一才是真的乱。
   九人在画布里的身高差 11%（scale 0.860–0.955），不校准就头顶不齐。

   只取 scale 与 x：校准表的 y 是为「站地」设计的（origin 是脚底 50% 100%，
   负 y 把人提离地面）。海报是半身取景、锚定顶部，套用 y 会把头顶切掉。 */
function portraitFraming(characterId: string): CSSProperties {
  const { scale, x } = getCalibration(characterId);
  return {
    width: `calc(var(--sortie-poster-w) * var(--sortie-poster-zoom) * ${scale})`,
    transform: `translateX(calc(-50% + ${x * 100}%))`
  };
}

function leaderAvatarFraming(characterId: string): CSSProperties {
  const { scale, x } = getCalibration(characterId);
  return {
    width: `calc(var(--sortie-slot-w) * var(--sortie-slot-zoom) * ${scale})`,
    transform: `translateX(calc(-50% + ${x * 100}%))`
  };
}

const FACTION_THEME: Record<SortieMember["faction"], string> = {
  "hero-party": "#e6c785",
  "demon-cadre": "#91c8ca",
  "demon-lord": "#cf827b"
};

export function SortieRosterPanel({
  roster,
  leader,
  party,
  onToggleMember,
  onClose
}: SortieRosterPanelProps) {
  const [inspected, setInspected] = useState<string | null>(null);

  const inParty = (id: string) => party.memberIds.includes(id);
  const ordered = roster
    .map((member, index) => ({ member, index, group: groupOf(member, inParty(member.id)) }))
    .sort((a, b) => (a.group === b.group ? a.index - b.index : a.group - b.group));

  /* 构成表的骰源：入队成员 + 亲征时的凯尔。凯尔目前没有骰面数据，
     所以第五骰对构成表的贡献是零 —— 这不是 bug，是他的骰装尚未落进 content。 */
  const partyMembers = party.memberIds
    .map((id) => roster.find((member) => member.id === id))
    .filter((member): member is SortieMember => Boolean(member));
  const dice = [
    ...partyMembers.map((member) => ({
      faces: member.faces,
      primarySuit: member.primarySuit,
      faction: member.faction
    })),
    ...(party.command === "personal" ? [{ faces: leader.faces }] : [])
  ];
  const composition = composeParty(dice);

  const focus = inspected ? roster.find((member) => member.id === inspected) : undefined;
  const focusComposition = focus
    ? composeParty([{ faces: focus.faces, primarySuit: focus.primarySuit, faction: focus.faction }])
    : null;

  return (
    /* 外框走 RpgFrame，不自己画 border —— 抽屉是浮在地图上的实体面板，
       与商店 / 档案的面板同级，边框语汇必须同源。 */
    <RpgFrame
      className="abyssa-sortie-roster"
      variant="dark"
      padding="none"
      role="region"
      aria-label="出战名单"
    >
      <header className="abyssa-sortie-roster__lab abyssa-sortie-roster__lab--list">
        <span className="abyssa-sortie-roster__title">出战名单</span>
        <span className="abyssa-sortie-roster__count">
          已选 {party.memberIds.length} / {SORTIE_SLOT_COUNT}
        </span>
      </header>

      <div
        className="abyssa-sortie-roster__row"
        onMouseLeave={() => setInspected(null)}
      >
        {ordered.map(({ member }) => {
          const chosen = inParty(member.id);
          const ready = isMemberAvailable(member);
          const slot = party.memberIds.indexOf(member.id) + 1;
          return (
            <button
              className="abyssa-sortie-poster"
              key={member.id}
              type="button"
              data-ready={ready || undefined}
              data-chosen={chosen || undefined}
              data-faction={member.faction}
              aria-pressed={chosen}
              aria-label={member.name}
              onClick={() => onToggleMember(member.id)}
              onMouseEnter={() => setInspected(member.id)}
              onFocus={() => setInspected(member.id)}
            >
              <span className="abyssa-sortie-poster__clip">
                <span className="abyssa-sortie-poster__art">
                  {member.portraitUrl ? (
                    <img src={member.portraitUrl} alt="" style={portraitFraming(member.id)} />
                  ) : (
                    <span className="abyssa-sortie-poster__void" aria-hidden="true" />
                  )}
                </span>
                {chosen && (
                  <RpgFacetDiamond
                    className="abyssa-sortie-poster__num"
                    label={String(slot)}
                    aria-hidden="true"
                  />
                )}
                <span className="abyssa-sortie-poster__nm">{member.shortName}</span>
                <span className="abyssa-sortie-poster__tag">{member.factionLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section
        className="abyssa-sortie-info-panel"
        aria-label={focus ? `${focus.name}出击资料` : "当前队伍信息"}
      >
        <header className="abyssa-sortie-roster__lab abyssa-sortie-roster__lab--info">
          <span className="abyssa-sortie-roster__summary">
            <span>{focus ? focus.name : "当前队伍"}</span>
            <em>
              {focus
                ? focus.factionLabel
                : `${composition.diceCount} 骰 · ${SORTIE_COMMAND_LABELS[party.command]}`}
            </em>
          </span>
          <IconButton
            className="abyssa-sortie-roster__done"
            label="完成编队"
            variant="dark"
            size="sm"
            shape="diamond"
            onClick={onClose}
          >
            <ConfirmPartyIcon />
          </IconButton>
        </header>

        <div className="abyssa-sortie-info">
        <div className="abyssa-sortie-info__dice">
          {focus ? (
            focus.faces.length > 0 ? (
              <FaceStrip faces={focus.faces} themeColor={FACTION_THEME[focus.faction]} />
            ) : (
              <p className="abyssa-sortie__muted">{focus.placeholderNote ?? "尚未编入远征队列"}</p>
            )
          ) : (
            <ul className="abyssa-sortie-info__minis">
              {Array.from({ length: SORTIE_SLOT_COUNT }, (_, index) => {
                const member = partyMembers[index];
                if (!member) {
                  return (
                    <li
                      className="abyssa-sortie-slot"
                      key={`empty-${index}`}
                      data-empty="true"
                    >
                      <AvatarFrame className="abyssa-sortie-slot__art" />
                      <span className="abyssa-sortie-slot__nm">空位</span>
                    </li>
                  );
                }
                return (
                  <li className="abyssa-sortie-slot" key={member.id} data-faction={member.faction}>
                    <AvatarFrame
                      className="abyssa-sortie-slot__art"
                      src={member.thumbnailUrl}
                      fallback={member.shortName.slice(0, 1)}
                    />
                    <span className="abyssa-sortie-slot__nm">{member.shortName}</span>
                  </li>
                );
              })}

              <li
                className="abyssa-sortie-slot"
                data-leader="true"
                data-enlisted={party.command === "personal" || undefined}
              >
                <AvatarFrame className="abyssa-sortie-slot__art" data-kind="portrait">
                  {leader.portraitUrl && (
                    <img
                      src={leader.portraitUrl}
                      alt=""
                      style={leaderAvatarFraming(leader.id)}
                    />
                  )}
                </AvatarFrame>
                <span className="abyssa-sortie-slot__nm">
                  {party.command === "personal" ? leader.shortName : "托管"}
                </span>
              </li>
            </ul>
          )}
        </div>

        <dl className="abyssa-sortie-info__kv">
          <div>
            <dt>战面</dt>
            <dd>
              <FaceTally composition={focus ? focusComposition! : composition} />
            </dd>
          </div>
          <div>
            <dt>花色</dt>
            <dd>
              <SuitTally composition={focus ? focusComposition! : composition} />
            </dd>
          </div>
          <div>
            <dt>{focus ? "私约" : "赌法"}</dt>
            <dd className="abyssa-sortie-info__note">
              {focus ? focus.pact ?? "尚无私约" : describeGamble(composition)}
            </dd>
          </div>
        </dl>
        </div>
      </section>
    </RpgFrame>
  );
}
