import type { ReactNode, Ref } from "react";
import { AvatarFrame } from "../../../shared/ui/primitives/AvatarFrame";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import { ItemSlotStatic } from "../../../shared/ui/primitives/ItemSlot";
import { RpgHexButton } from "../../../shared/ui/primitives/RpgHexButton";
import padlockIcon from "../../../assets/icons/items/padlock.svg";
import formationIcon from "../../../assets/icons/crossed-swords.svg";
import backpackIcon from "../../../assets/icons/items/backpack.svg";
import { MapDocument } from "../MapDocument";
import { SORTIE_SPOIL_ICONS, maskStyle } from "./sortie-icons";
import type { QuestBrief, QuestYieldGrade } from "./sortie-quests";
import { SORTIE_COMMAND_LABELS, SORTIE_SLOT_COUNT, composeParty } from "./sortie-model";
import { slotPortraitFraming } from "./sortie-roster";
import type { SortieLeader, SortieMember, SortieParty } from "./sortie-model";
import type { MapLocationConfig } from "../types";

/* ============ 委托书 ============
 *
 * 点地标后摆上作战桌的一份文书（MapDocument：地图画框缩小版里的纸与木台）。
 *   纸 + 墨     —— 文书：版画、风味、路线、敌情、收获。纸裁自地图本身的羊皮纸；
 *                 版画边缘化进纸里，路线沿用地图的虚线与节点画法。正文沿左侧排开，
 *                 朱字小标分段，敌情分条，收获按行对齐。
 *   木台 + 黄铜 —— 工具：队伍、行囊、出发。
 * 可出发时委托书占满视口高度，正文在版画下方自然往下排；未开放时只有纸，高度随内容。
 * 内容过长时只有纸面滚动，木台钉住不动。
 *
 * 回答「这地方是什么、带谁去、带什么、走不走」，不回答「难度几星、胜率多少」
 * —— 编队即难度，数字会替玩家把牌读完。 */

/** closed：此处没有可走的路线；active：已有远征，主按钮改为返回；
 *  saving / preparing：存档或安排进行中；ready：可出发（notice 为拦截理由）。 */
export type SortieDossierStatus = "ready" | "closed" | "active" | "saving" | "preparing";

export interface SortieDossierRoute {
  layerCount: number;
  exitLayers: readonly number[];
  ending: "plain" | "manor";
}

export interface SortieDossierBagItem {
  id: string;
  name: string;
  icon?: string;
  quantity: number;
}

export interface SortieDossierProps {
  location: MapLocationConfig;
  side: "left" | "right";
  status: SortieDossierStatus;
  brief?: QuestBrief;
  route?: SortieDossierRoute;
  /** 进行中的委托便条；没有就不画。 */
  commissions?: ReactNode;
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  /** 行囊；没有出征补给的存档不画这一行。 */
  bag?: { items: readonly SortieDossierBagItem[]; limit: number };
  /** ready 时为出发被拦下的理由；closed 时为开放条件。 */
  notice?: string | null;
  /** 出征安排失败等需要立即读到的错误。 */
  error?: string;
  resumeLabel?: string;
  bagTriggerRef?: Ref<HTMLButtonElement>;
  onEditParty: () => void;
  onEditBag?: () => void;
  onDepart: () => void;
  onResume?: () => void;
  onClose: () => void;
}

/** 行囊恒画六格（储藏室满级的容量）；超出当前容量的几格上锁，升级储藏室后才开。 */
const BAG_SOCKETS = 6;

const STAR_PATH = "M6 .8l1.55 3.35 3.65.42-2.72 2.48.76 3.6L6 8.82l-3.24 1.83.76-3.6L.8 4.57l3.65-.42z";

/** 收益刻度：三枚墨印星，实心为满、空心为缺，与正文同一种墨。 */
function InkStars({ grade }: { grade: QuestYieldGrade }) {
  return (
    <span className="abyssa-sortie-dossier__stars" role="img" aria-label={`${grade} 星收益`}>
      {[1, 2, 3].map((star) => (
        <svg key={star} viewBox="0 0 12 12" data-active={star <= grade || undefined} aria-hidden="true"><path d={STAR_PATH} /></svg>
      ))}
    </span>
  );
}

/** 行军线沿版心展开：每层一步；层数多到放不下时整体等比收窄，节点永远是圆的。
 *  两端留出一个注字的半宽。 */
const TRAIL_STEP = 68;
const TRAIL_PAD = 24;
const TRAIL_Y = 22;
const TRAIL_H = 52;

/** 路线：地图同款的虚线小径与节点（深色圆点 + 浅色芯）。可撤离层套虚线环、插朱砂小旗，
 *  庄园终场加实线环；只给这两种节点写注，层数一眼数得出，不再逐层标号。 */
function RouteTrail({ route }: { route: SortieDossierRoute }) {
  const width = Math.max(280, TRAIL_PAD * 2 + TRAIL_STEP * Math.max(route.layerCount - 1, 0));
  const step = (width - TRAIL_PAD * 2) / Math.max(route.layerCount - 1, 1);
  const layers = Array.from({ length: route.layerCount }, (_, index) => ({
    layer: index + 1,
    x: TRAIL_PAD + index * step,
    exit: route.exitLayers.includes(index + 1),
    finale: route.ending === "manor" && index + 1 === route.layerCount
  }));
  /* 每段一道缓弧、正反交替，像手描的行军线而不是直尺线。 */
  const path = layers.slice(1).reduce(
    (d, { x }, index) => `${d} Q ${x - step / 2} ${TRAIL_Y + (index % 2 ? 3 : -3)} ${x} ${TRAIL_Y}`,
    `M ${TRAIL_PAD} ${TRAIL_Y}`
  );
  const exits = route.exitLayers.join("、");
  const caption = [`${route.layerCount} 层`, exits && `第 ${exits} 层可撤离`, route.ending === "manor" && `第 ${route.layerCount} 层终场`]
    .filter(Boolean).join(" · ");
  return (
    <div className="abyssa-sortie-dossier__route">
      <svg className="abyssa-sortie-dossier__trail" width={width} height={TRAIL_H} viewBox={`0 0 ${width} ${TRAIL_H}`} aria-hidden="true">
        <path data-part="path" d={path} />
        {layers.map(({ layer, x, exit, finale }) => (
          <g key={layer}>
            {finale && <circle data-part="finale" cx={x} cy={TRAIL_Y} r={exit ? 13 : 9.5} />}
            {exit && <circle data-part="ring" cx={x} cy={TRAIL_Y} r={9.5} />}
            {exit && <path data-part="staff" d={`M ${x} ${TRAIL_Y - 9.5} V 1.5`} />}
            {exit && <path data-part="flag" d={`M ${x + .6} 1.5 L ${x + 11} 5 L ${x + .6} 8.5 Z`} />}
            <circle data-part="dot" cx={x} cy={TRAIL_Y} r={4.6} />
            <circle data-part="eye" cx={x} cy={TRAIL_Y} r={1.6} />
            {(exit || finale) && <text x={x} y={49}>{exit ? "可撤离" : "终场"}</text>}
          </g>
        ))}
      </svg>
      <p className="abyssa-sortie__sr">{caption}</p>
    </div>
  );
}

function Yields({ brief }: { brief: QuestBrief }) {
  return (
    <ul className="abyssa-sortie-dossier__yields">
      {brief.yields.map((entry) => (
        <li key={entry.spoil} data-spoil={entry.spoil}>
          {/* 资金与晶石沿用全仓库统一的货币形制；素材走 mask 图标。 */}
          {entry.spoil === "material"
            ? <i className="abyssa-sortie-dossier__spoil" style={maskStyle(SORTIE_SPOIL_ICONS.material)} aria-hidden="true" />
            : <span className="abyssa-currency-amount abyssa-sortie-dossier__coin" data-currency={entry.spoil === "coin" ? "lira" : "crystal"} aria-hidden="true">
              <i><span data-part="ring" /><span data-part="mark" /></i>
            </span>}
          <span>{entry.label}</span>
          <InkStars grade={entry.grade} />
        </li>
      ))}
    </ul>
  );
}

/** 队伍席位：与编队抽屉同一个头像件（.abyssa-sortie-slot__art），同伴放 1:1 头像；
 *  玩家位没有头像，放档案立绘并按校准取景。 */
function PartyChip({ name, member, leader, enlisted }: {
  name: string; member?: SortieMember; leader?: SortieLeader; enlisted?: boolean;
}) {
  return (
    <li className="abyssa-sortie-dossier__chip" data-faction={member?.faction} data-leader={leader ? true : undefined}
      data-enlisted={enlisted || undefined} data-empty={!member && !leader || undefined} title={name}>
      {leader
        ? <AvatarFrame className="abyssa-sortie-slot__art abyssa-sortie-dossier__chip-art" data-kind="portrait">
          {leader.portraitUrl && <img src={leader.portraitUrl} alt="" draggable={false} style={slotPortraitFraming(leader.id)} />}
        </AvatarFrame>
        : <AvatarFrame className="abyssa-sortie-slot__art abyssa-sortie-dossier__chip-art"
          src={member?.thumbnailUrl} fallback={member?.shortName.slice(0, 1)} />}
      <span className="abyssa-sortie__sr">{name}</span>
    </li>
  );
}

export function SortieDossier({
  location, side, status, brief, route, commissions, roster, leader, party, bag, notice, error,
  resumeLabel = "继续远征", bagTriggerRef, onEditParty, onEditBag, onDepart, onResume, onClose
}: SortieDossierProps) {
  const members = party.memberIds
    .map((id) => roster.find((member) => member.id === id))
    .filter((member): member is SortieMember => Boolean(member));
  const enlisted = party.command === "personal";
  const composition = composeParty([
    ...members.map((member) => ({ faces: member.faces, primarySuit: member.primarySuit, faction: member.faction })),
    ...(enlisted ? [{ faces: leader.faces }] : [])
  ]);
  const closed = status === "closed";
  const carried = bag?.items ?? [];
  const open = bag ? Math.min(Math.max(bag.limit, carried.length), BAG_SOCKETS) : 0;
  const plateLabel = status === "saving" ? "保存中…" : status === "preparing" ? "正在安排…" : "出发";

  const hasFacts = !!(route || brief?.event || brief?.threats.length || brief?.yields.length);

  return (
    <MapDocument as="aside" className="abyssa-sortie-dossier" data-side={side} data-state={status}
      role="complementary" aria-label={`${location.name} 委托`}
      title={location.name} closeLabel="关闭委托" onClose={onClose}
      ledge={!closed && <>
        {status !== "active" && <>
          {/* 槽左端是竖排的木刻标签，右端是工具钮；骰数与亲征写进组名，
              一眼看到的只有人和物。 */}
          <div className="abyssa-sortie-dossier__row" role="group"
            aria-label={`出战队伍：${composition.diceCount} 骰 · ${SORTIE_COMMAND_LABELS[party.command]}`}>
            <b className="abyssa-sortie-dossier__row-label" aria-hidden="true">队伍</b>
            {/* 四个可选席恒定画出，空位也占地 —— 玩家得看见还剩几个孔；第五席是玩家。 */}
            <ul className="abyssa-sortie-dossier__chips">
              {Array.from({ length: SORTIE_SLOT_COUNT }, (_, index) => {
                const member = members[index];
                return member
                  ? <PartyChip key={member.id} name={member.name} member={member} />
                  : <PartyChip key={`empty-${index}`} name="空位" />;
              })}
              <PartyChip name={enlisted ? `${leader.name} · 亲征` : `${leader.name} · 托管`} leader={leader} enlisted={enlisted} />
            </ul>
            {/* 工具钮嵌在凹槽末端，与关闭钮同一枚共享圆钮。 */}
            <IconButton className="abyssa-map-document__tool" label="编队" title="编队" size="sm" onClick={onEditParty}>
              <i style={maskStyle(formationIcon)} />
            </IconButton>
          </div>
          {bag && <div className="abyssa-sortie-dossier__row" role="group" aria-label={`出征行囊：${carried.length} / ${bag.limit}`}>
            <b className="abyssa-sortie-dossier__row-label" aria-hidden="true">行囊</b>
            <ul className="abyssa-sortie-dossier__bag">
              {Array.from({ length: BAG_SOCKETS }, (_, index) => {
                const item = carried[index];
                const locked = index >= open;
                return <li key={item?.id ?? `empty-${index}`} data-locked={locked || undefined}>
                  <ItemSlotStatic icon={item?.icon} name={item?.name ?? (locked ? "未解锁" : "空位")} tone="interface" showRarity={false} />
                  {locked && <i className="abyssa-sortie-dossier__lock" style={maskStyle(padlockIcon)} aria-hidden="true" />}
                  {item && item.quantity > 1 && <span className="abyssa-item-count" aria-hidden="true">{item.quantity}</span>}
                </li>;
              })}
            </ul>
            <IconButton ref={bagTriggerRef} className="abyssa-map-document__tool" label="整备" title="整备" size="sm"
              disabled={!onEditBag} onClick={onEditBag}>
              <i style={maskStyle(backpackIcon)} />
            </IconButton>
          </div>}
        </>}

        <div className="abyssa-map-document__go">
          {error ? <p className="abyssa-map-document__notice" data-tone="error" role="alert">{error}</p>
            : status === "active" ? <p className="abyssa-map-document__notice" role="status">已有远征进行中，请先继续或完成结算。</p>
            : notice && status === "ready" && <p className="abyssa-map-document__notice" role="status">{notice}</p>}
          {status === "active"
            ? <RpgHexButton className="abyssa-map-document__action" variant="dark" size="sm" fullWidth onClick={onResume}>{resumeLabel}</RpgHexButton>
            : <RpgHexButton className="abyssa-map-document__action" variant="dark" size="sm" fullWidth
              disabled={status !== "ready" || !!notice} title={notice ?? undefined} onClick={onDepart}>{plateLabel}</RpgHexButton>}
        </div>
      </>}>
      <div className="abyssa-sortie-dossier__scroll" tabIndex={0} aria-label="路线与委托详情">
        {brief?.sceneImageUrl && (
          <figure className="abyssa-sortie-dossier__print">
            <img src={brief.sceneImageUrl} alt="" draggable={false} />
            {closed && <span className="abyssa-sortie-dossier__stamp">未开放</span>}
          </figure>
        )}
        <div className="abyssa-sortie-dossier__text">
          {!closed && commissions && <div className="abyssa-sortie-dossier__slip">{commissions}</div>}
          {brief?.flavor && <p className="abyssa-sortie-dossier__flavor">{brief.flavor}</p>}
          {closed ? (
            notice && <p className="abyssa-sortie-dossier__condition">
              <i style={maskStyle(padlockIcon)} aria-hidden="true" />{notice}
            </p>
          ) : hasFacts && (
            <dl className="abyssa-sortie-dossier__facts">
              {(route || brief?.event) && <div data-fact="route">
                <dt className="abyssa-map-rubric">路线</dt>
                <dd>{route ? <RouteTrail route={route} /> : brief?.event}</dd>
              </div>}
              {!!brief?.threats.length && <div data-fact="threats">
                <dt className="abyssa-map-rubric">敌情</dt>
                {/* 一条敌情一行，行尾不加标点。 */}
                <dd><ul>{brief.threats.map((threat) => <li key={threat}>{threat}</li>)}</ul></dd>
              </div>}
              {!!brief?.yields.length && <div data-fact="yields">
                <dt className="abyssa-map-rubric">收获</dt>
                <dd><Yields brief={brief} /></dd>
              </div>}
            </dl>
          )}
        </div>
      </div>
    </MapDocument>
  );
}
