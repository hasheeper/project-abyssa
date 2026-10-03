import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  DIE_FACE_ACTION_LABELS,
  DIE_SUIT_LABELS,
  DIE_SUIT_SHAPES,
  fateEntersHand
} from "../../../shared/domain/dice/face";
import type { DieFace } from "../../../shared/domain/dice/face";
import { ExpeditionFlatDieFrame } from "../../../shared/ui/dice-face/ExpeditionFlatDieFrame";
import { ArrowButton } from "../../../shared/ui/primitives/ArrowButton";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import { RpgHexButton } from "../../../shared/ui/primitives/RpgHexButton";
import { getCalibration } from "../../../shared/ui/patterns/spriteCalibration";
import { useUiMotion } from "../../../shared/ui/motion/UiMotionProvider";
import archiveIcon from "../../../assets/icons/items/black-book.svg";
import { rosterCardField } from "../../../assets/map/roster/catalog";
import { MapDocument } from "../MapDocument";
import { partyFigureStyle } from "./party-figure";
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
 * 编队时摆在作战桌下沿的一排人物牌，右侧一份资料页（MapDocument）。
 *
 * 牌是同一张羊皮纸按阵营染色印成的：勇者小队本色纸、圆拱；魔王干部蓝纸、尖拱；
 * 魔王紫纸、三叶拱。拱龛里印着各人的专色与彩色立绘，头与帽越出牌顶。
 * 牌的上方立着一枚带底座的立牌 —— 就是地图上那枚 Q 版队伍立牌（卡纸刀模切下的），
 * 下沿插进胡桃木底座的槽里。入队时整枚立牌从牌后升起、晃两下站稳；退队时沉回牌后。
 * 地图上的队伍这时下台，「谁在队里」只看牌上方有没有人站着。
 * 牌底、色场、立牌与底座都是离线印好的图（scripts/prepare-map-dossier.py），这里只叠层。
 * 入队的牌镶黄铜边；候选的牌色场褪掉。牌面上不贴徽章与序号。
 *
 * 资料页平时是当前队伍的构成（战面与花色）与赌法；指到某张牌时换成这个人的六面骰与私约。
 * 所有读数都由 composeParty / describeGamble 推导，本组件不自己数骰面。
 *
 * 名单排序：已在队（按席位）→ 出击资料完整 → 待补资料。三组之内保持档案原序。
 * 排序只在翻开名单时定一次，之后入队、退队，牌都留在原位：立牌就在玩家点的
 * 那张牌上弹起，整排不跟着跳。三组都可切换；伤势或缺骰面只会拦截最后出发。 */

export interface SortieRosterPanelProps {
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  onToggleMember: (memberId: string) => void;
  onClose: () => void;
  /** 翻到某人的角色档案；不给就不放档案钮。 */
  onInspect?: (id: string) => void;
}

type RosterGroup = 0 | 1 | 2;

/* 出征的人排最前 —— 那是这一屏的答案（「我这趟带了谁」），
   不该混在候选中间等玩家去找。 */
function groupOf(member: SortieMember, inParty: boolean): RosterGroup {
  if (inParty) return 0;
  return isMemberAvailable(member) ? 1 : 2;
}

/** 翻开名单那一刻的牌序（成员 id）。已在队的按席位排，席位就是出战顺序。 */
function rankRoster(roster: readonly SortieMember[], memberIds: readonly string[]): string[] {
  return roster
    .map((member, index) => {
      const slot = memberIds.indexOf(member.id);
      return { id: member.id, order: slot < 0 ? index : slot, group: groupOf(member, slot >= 0) };
    })
    .sort((a, b) => (a.group === b.group ? a.order - b.order : a.group - b.group))
    .map((entry) => entry.id);
}

/* 翻开名单时，已在队的立牌等牌升到位，再从左到右依次弹起。
   时值交给 CSS 变量，样式表与下面收起「依次」的计时器读同一组数。 */
const STANDEE_ENTRY = { wait: 280, step: 90, pop: 900 } as const;
const STANDEE_ENTRY_MS = STANDEE_ENTRY.wait + STANDEE_ENTRY.step * SORTIE_SLOT_COUNT + STANDEE_ENTRY.pop;

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

/** 六面一排。沉眠面按 seal="none" 渲染，与骰装页同一套骰面件。
 *  live 档案带品质（锈/金）与花色可知性：旧版规则不提供花色时不冒充
 *  （与 DiceLoadoutPanel 同一处理——花色角标退回中性底板，标题不报花色）。 */
function FaceStrip({ faces, themeColor }: { faces: readonly DieFace[]; themeColor: string }) {
  return (
    <div className="abyssa-sortie__strip">
      {faces.slice(0, 6).map((face) => {
        const awake = fateEntersHand(face.fate);
        const suitKnown = !face.live || face.live.suitKnown;
        const label = face.live?.actionLabel ?? DIE_FACE_ACTION_LABELS[face.action];
        return (
          <span
            className="abyssa-sortie__strip-cell"
            key={face.face}
            data-fate={face.fate}
            title={
              awake
                ? `第 ${face.face} 面 · ${label} ${face.power} · 命数 ${face.wildPip ? "万能" : face.pip}${suitKnown ? ` · ${DIE_SUIT_LABELS[face.suit]}` : ""}`
                : `第 ${face.face} 面 · 沉眠`
            }
          >
            <ExpeditionFlatDieFrame
              action={face.action}
              fate={face.pip}
              power={face.power}
              seal={face.live?.quality ?? (awake ? "plain" : "none")}
              suitShape={suitKnown ? DIE_SUIT_SHAPES[face.suit] : undefined}
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

/** live 花色未知（旧版规则）时，花色构成与同花提示都不该出现。 */
function suitsKnown(faces: readonly DieFace[]): boolean {
  return faces.every((face) => !face.live || face.live.suitKnown);
}

const FACTION_THEME: Record<SortieMember["faction"], string> = {
  "hero-party": "#e6c785",
  "demon-cadre": "#91c8ca",
  "demon-lord": "#cf827b"
};

/* 立绘取景沿用 RP 那套逐角色校准（spriteCalibration）：九人在画布里的身高差 11%，
   不校准就头顶不齐。只取 scale 与 x —— 校准表的 y 是为「站地」设计的，
   这里锚定牌顶，头与帽越出牌顶多少由 --roster-breakout 统一给出。 */
function cardFraming(characterId: string): CSSProperties {
  const { scale, x } = getCalibration(characterId);
  return {
    width: `calc(var(--roster-card-w) * var(--roster-zoom) * ${scale})`,
    transform: `translateX(calc(-50% + ${x * 100}%))`
  };
}

function RosterCard({ member, index, chosen, onToggle, onInspect }: {
  member: SortieMember;
  /** 牌在这一排的位置：翻开名单时，立牌按它依次弹起。 */
  index: number;
  chosen: boolean;
  onToggle: () => void;
  onInspect: () => void;
}) {
  const field = rosterCardField(member.id);
  const latin = member.secondaryName?.split(" ")[0];
  return (
    <button
      className="abyssa-sortie-poster"
      type="button"
      data-faction={member.faction}
      data-member={member.id}
      data-chosen={chosen || undefined}
      data-ready={isMemberAvailable(member) || undefined}
      aria-pressed={chosen}
      aria-label={member.name}
      style={{ "--poster-index": index } as CSSProperties}
      onClick={onToggle}
      onMouseEnter={onInspect}
      onFocus={onInspect}
    >
      {/* 立牌就是地图上那枚队伍立牌，连底座站在牌顶上方：先画，牌与出框的头就压在它前面；
          没入队时整枚沉在牌后。 */}
      {member.figureUrl && (
        <span className="abyssa-sortie-poster__standee" aria-hidden="true">
          <span className="abyssa-sortie-poster__lift">
            <span className="abyssa-sortie-poster__piece">
              <span className="abyssa-sortie-poster__base" />
              <img src={member.figureUrl} alt="" draggable={false} style={partyFigureStyle(member.id)} />
            </span>
          </span>
        </span>
      )}
      <span className="abyssa-sortie-poster__sheet" aria-hidden="true">
        {field && <img className="abyssa-sortie-poster__field" src={field} alt="" draggable={false} />}
      </span>
      <span className="abyssa-sortie-poster__art" aria-hidden="true">
        {member.portraitUrl && <img src={member.portraitUrl} alt="" draggable={false} style={cardFraming(member.id)} />}
      </span>
      <span className="abyssa-sortie-poster__label">
        {member.title && <em>{member.title}</em>}
        <b className="abyssa-sortie-poster__nm">{member.shortName}</b>
        {latin && <small aria-hidden="true">{latin}</small>}
      </span>
    </button>
  );
}

export function SortieRosterPanel({
  roster,
  leader,
  party,
  onToggleMember,
  onClose,
  onInspect
}: SortieRosterPanelProps) {
  const { reduced } = useUiMotion();
  const [ranking] = useState(() => rankRoster(roster, party.memberIds));
  const [entering, setEntering] = useState(!reduced);
  const [lastInspected, setLastInspected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  /* 牌多于一屏时，牌架才做成横向滚动，两端出现翻页钮；不露网页滚动条。 */
  const [more, setMore] = useState({ scroll: false, before: false, after: false });

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    /* 牌排到哪儿只看最后一张牌：立牌比牌宽，scrollWidth 会被它撑出一截。 */
    const last = rail.lastElementChild as HTMLElement | null;
    const end = last ? last.offsetLeft + last.offsetWidth + parseFloat(getComputedStyle(rail).paddingRight) : 0;
    const scroll = end > rail.clientWidth + 1;
    const before = scroll && rail.scrollLeft > 4;
    const after = scroll && rail.scrollLeft + rail.clientWidth < end - 4;
    setMore((current) =>
      current.scroll === scroll && current.before === before && current.after === after ? current : { scroll, before, after });
  }, []);

  useEffect(() => {
    measure();
    const rail = railRef.current;
    if (!rail || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [measure, roster.length]);

  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(false), STANDEE_ENTRY_MS);
    return () => window.clearTimeout(timer);
  }, [entering]);

  const page = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.8, behavior: reduced ? "auto" : "smooth" });
  };

  const inParty = (id: string) => party.memberIds.includes(id);
  /* 翻开之后才进名单的人（档案晚到）排在末尾。 */
  const ordered = roster
    .map((member, index) => {
      const rank = ranking.indexOf(member.id);
      return { member, rank: rank < 0 ? ranking.length + index : rank };
    })
    .sort((a, b) => a.rank - b.rank);

  /* 构成表的骰源：入队成员 + 亲征时的玩家位。玩家位目前没有骰面数据，
     所以第五骰对构成表的贡献是零 —— 这不是 bug，是他的骰装尚未落进 content。 */
  const partyMembers = party.memberIds
    .map((id) => roster.find((member) => member.id === id))
    .filter((member): member is SortieMember => Boolean(member));
  const composition = composeParty([
    ...partyMembers.map((member) => ({
      faces: member.faces,
      primarySuit: member.primarySuit,
      faction: member.faction
    })),
    ...(party.command === "personal" ? [{ faces: leader.faces }] : [])
  ]);
  /* 旧版档案不提供花色：构成表照常给战面，但花色行与同花提示不冒充。 */
  const partySuitsKnown =
    partyMembers.every((member) => suitsKnown(member.faces)) && suitsKnown(leader.faces);

  const focus = inspected ? roster.find((member) => member.id === inspected) : undefined;
  const subject = roster.find((member) => member.id === lastInspected);

  return (
    <section
      className="abyssa-sortie-roster"
      role="region"
      aria-label="出战名单"
      data-entering={entering || undefined}
      style={{
        "--roster-standee-wait": `${STANDEE_ENTRY.wait}ms`,
        "--roster-standee-step": `${STANDEE_ENTRY.step}ms`,
        "--roster-standee-pop": `${STANDEE_ENTRY.pop}ms`
      } as CSSProperties}
    >
      <div className="abyssa-sortie-roster__shelf" data-scroll={more.scroll || undefined}
        data-more-before={more.before || undefined} data-more-after={more.after || undefined}>
        <div
          ref={railRef}
          className="abyssa-sortie-roster__rail"
          onScroll={measure}
          onWheel={(event) => {
            /* 竖滚轮横着翻牌：这一排只有横向。 */
            if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
          }}
          onMouseLeave={() => setInspected(null)}
        >
          {ordered.map(({ member }, index) => (
            <RosterCard
              key={member.id}
              member={member}
              index={index}
              chosen={inParty(member.id)}
              onToggle={() => onToggleMember(member.id)}
              onInspect={() => { setInspected(member.id); setLastInspected(member.id); }}
            />
          ))}
        </div>
        {more.before && (
          <ArrowButton className="abyssa-map-document__tool abyssa-sortie-roster__pager" data-direction="before"
            direction="left" label="向前翻" size="sm" onClick={() => page(-1)} />
        )}
        {more.after && (
          <ArrowButton className="abyssa-map-document__tool abyssa-sortie-roster__pager" data-direction="after"
            direction="right" label="向后翻" size="sm" onClick={() => page(1)} />
        )}
      </div>

      <MapDocument
        className="abyssa-sortie-roster__sheet"
        title={focus ? focus.shortName : "当前队伍"}
        aria-label={focus ? `${focus.name}出击资料` : "当前队伍信息"}
        ledge={
          <div className="abyssa-map-document__go">
            <p className="abyssa-map-document__notice" role="status">
              <span>已选 {party.memberIds.length} / {SORTIE_SLOT_COUNT}</span>
              <span className="abyssa-sortie-roster__meta">
                {composition.diceCount} 骰 · {SORTIE_COMMAND_LABELS[party.command]}
              </span>
            </p>
            <div className="abyssa-sortie-roster__actions">
              {onInspect && (
                <IconButton className="abyssa-map-document__tool" size="sm"
                  label={`查看${subject?.shortName ?? leader.shortName}档案`}
                  title={`查看${subject?.shortName ?? leader.shortName}档案`}
                  onClick={() => onInspect(subject?.id ?? leader.id)}>
                  <i style={maskStyle(archiveIcon)} />
                </IconButton>
              )}
              <RpgHexButton className="abyssa-map-document__action" variant="dark" size="sm" layout="compact" onClick={onClose}>
                完成编队
              </RpgHexButton>
            </div>
          </div>
        }
      >
        <div className="abyssa-sortie-roster__page">
          {focus ? (
            <>
              {focus.faces.length > 0
                ? <FaceStrip faces={focus.faces} themeColor={FACTION_THEME[focus.faction]} />
                : <p className="abyssa-sortie__muted">{focus.placeholderNote ?? "尚未编入远征队列"}</p>}
              <dl className="abyssa-sortie-roster__facts">
                <div>
                  <dt className="abyssa-map-rubric">私约</dt>
                  <dd>{focus.pact ?? "尚无私约"}</dd>
                </div>
              </dl>
            </>
          ) : (
            <dl className="abyssa-sortie-roster__facts">
              {/* 战面一行、花色一行：图标是招式，几何底板是花色，两行不必各挂一枚小标。 */}
              <div>
                <dt className="abyssa-map-rubric">构成</dt>
                <dd><FaceTally composition={composition} /></dd>
                <dd>
                  {partySuitsKnown
                    ? <SuitTally composition={composition} />
                    : <span className="abyssa-sortie__muted">花色 · 此版本未提供</span>}
                </dd>
              </div>
              <div>
                <dt className="abyssa-map-rubric">赌法</dt>
                <dd>
                  {describeGamble(
                    /* 花色未知时不给同花提示：旧版占位花色不该被拿去许诺同花。 */
                    partySuitsKnown ? composition : { ...composition, dominantSuit: null }
                  ).match(/[^；，]+[；，]?/gu)?.map((phrase, index) => (
                    <span className="abyssa-sortie-roster__clause" key={index}>{phrase}</span>
                  ))}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </MapDocument>
    </section>
  );
}
