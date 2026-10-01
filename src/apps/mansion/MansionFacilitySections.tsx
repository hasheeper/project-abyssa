import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import type { FacilityCommand } from "../../game-core/contracts/facilities";
import type { FacilitiesView } from "../../game-runtime/facilities-view";
import { ManorGlyph } from "../../shared/ui/patterns/ManorSection";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { ItemSlot, ItemSlotStatic } from "../../shared/ui/primitives/ItemSlot";
import { QuantityStepper } from "../../shared/ui/primitives/QuantityStepper";
import { RpgFacetDiamond } from "../../shared/ui/primitives/RpgFacetDiamond";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import backpackGlyph from "../../assets/icons/items/backpack.svg";
import bookGlyph from "../../assets/icons/items/open-book.svg";
import candlesGlyph from "../../assets/icons/items/candles.svg";
import cauldronGlyph from "../../assets/icons/items/cauldron.svg";
import coinsGlyph from "../../assets/icons/items/coins-pile.svg";
import crateGlyph from "../../assets/icons/items/cargo-crate.svg";
import hammerGlyph from "../../assets/icons/items/hammer-nails.svg";
import herbsGlyph from "../../assets/icons/items/herbs-bundle.svg";
import mealGlyph from "../../assets/icons/items/hot-meal.svg";
import needleGlyph from "../../assets/icons/items/sewing-needle.svg";
import padlockGlyph from "../../assets/icons/items/padlock.svg";
import scrollGlyph from "../../assets/icons/items/scroll-unfurled.svg";
import seedGlyph from "../../assets/icons/items/plant-seed.svg";
import watchGlyph from "../../assets/icons/items/pocket-watch.svg";
import woodenCrateGlyph from "../../assets/icons/items/wooden-crate.svg";
import { MarkerGlyph, PromoteIcon, RepairIcon, type MarkerTone } from "./MansionMarkers";

export type FacilityRoom = FacilitiesView["rooms"][number];

type FacilitySectionProps = {
  view: FacilitiesView;
  room: FacilityRoom;
  /** definitionId -> 物品图标 URL,见 useMansionEstate 的 itemIcons。 */
  icons: Readonly<Record<string, string>>;
  busy: boolean;
  onCommand: (command: FacilityCommand) => void;
};

/* ============ 图标 ============
   全部取自 game-icons 素材库(src/assets/icons/items),与世界图钉、仓库同源。 */
export const OVERVIEW_GLYPH = scrollGlyph;
export const TRACE_GLYPH = candlesGlyph;
export const WORKS_GLYPH = hammerGlyph;
export const FACILITY_ROOM_GLYPHS: Readonly<Record<string, string>> = {
  kitchen: mealGlyph,
  greenhouse: herbsGlyph,
  workshop: cauldronGlyph,
  storage: crateGlyph,
  maid: needleGlyph
};
/** 储藏室的三项改进各有其物;其余房间的改进项沿用房间图标。 */
const IMPROVEMENT_GLYPHS: Readonly<Record<string, string>> = {
  出征补给: backpackGlyph,
  每种原料: herbsGlyph,
  补给库存: crateGlyph
};

/** 区块徽记:世界图钉同款八角牌面。 */
function RoomEmblem({ tone, children }: { tone: MarkerTone; children: ReactNode }) {
  return <span className="mansion-room-emblem" data-tone={tone} aria-hidden="true">{children}</span>;
}

/* ============ 区块:名牌 + 内凹面板 ============
   名牌骑在面板上沿(参考 references/images/ui-controls-reference.jpg 的 name tag),
   不再是「小字 + 发丝引线」的网页分节。 */
export function RoomSection({ label, glyph, tone = "neutral", emblem, children }: {
  label: string;
  glyph?: string;
  tone?: MarkerTone;
  emblem?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mansion-room-panel">
      <header className="mansion-room-panel__tag">
        {emblem ?? (glyph && <RoomEmblem tone={tone}><MarkerGlyph glyph={glyph} tone={tone} /></RoomEmblem>)}
        <h3>{label}</h3>
      </header>
      {children}
    </section>
  );
}

/** 提示:内凹铭牌 + 图标,不画彩色边框警告框。 */
export function RoomNotice({ children, glyph = padlockGlyph, tone, status }: {
  children: ReactNode;
  glyph?: string;
  tone?: "alert";
  status?: boolean;
}) {
  return (
    <p className="mansion-room-notice" data-tone={tone} role={status ? "status" : undefined}>
      <ManorGlyph className="mansion-room-glyph" src={glyph} />
      <span>{children}</span>
    </p>
  );
}

/** 相位刻度:每个相位一枚切面菱形,与顶部相位栏同一语言。 */
function PhaseTrack({ label, total, remaining }: { label: string; total: number; remaining: number }) {
  const cells = Math.max(1, total);
  const done = Math.max(0, Math.min(cells, cells - remaining));
  return (
    <span
      className="mansion-room-phases"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={cells}
      aria-valuenow={done}
    >
      {Array.from({ length: cells }, (_, index) => (
        <RpgFacetDiamond
          key={index}
          label=""
          aria-hidden="true"
          state={index < done ? "elapsed" : index === done ? "current" : "coming"}
        />
      ))}
    </span>
  );
}

function TimeLeft({ label, total, remaining, done }: {
  label: string;
  total: number;
  remaining: number;
  done: string;
}) {
  return (
    <div className="mansion-room-time">
      <PhaseTrack label={label} total={total} remaining={remaining} />
      <span className="mansion-room-time__text">
        <ManorGlyph className="mansion-room-glyph" src={watchGlyph} />
        {remaining ? `还需 ${remaining} 个时段` : done}
      </span>
    </div>
  );
}

/** 头部的设施等级:三枚切面菱形。上限由设施视图给出,界面里不另写一个数。 */
export function FacilityGrade({ view, room }: { view: FacilitiesView; room: FacilityRoom }) {
  const building = view.construction?.roomId === room.id;
  const status = room.level ? `Lv.${room.level} / ${view.maxLevel}` : room.build ? "待修缮" : "待启用";
  return (
    <div
      className="mansion-facility-grade"
      role="progressbar"
      aria-label={`设施等级 ${status}`}
      aria-valuemin={0}
      aria-valuemax={view.maxLevel}
      aria-valuenow={room.level}
    >
      <span className="mansion-facility-grade__gems" aria-hidden="true">
        {Array.from({ length: view.maxLevel }, (_, index) => (
          <RpgFacetDiamond
            key={index}
            label={String(index + 1)}
            state={index < room.level - 1 ? "elapsed" : index === room.level - 1 ? "current" : "coming"}
            data-building={building && index === room.level ? "" : undefined}
          />
        ))}
      </span>
      <span className="mansion-facility-grade__value" aria-hidden="true">
        {room.level ? <><b>Lv.{room.level}</b><s>/ {view.maxLevel}</s></> : status}
      </span>
    </div>
  );
}

/** 物品格 + 名称说明;右侧可挂一个操作。 */
function ItemLine({ slot, title, children, action }: {
  slot: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mansion-room-item" data-action={action ? "" : undefined}>
      {slot}
      <div className="mansion-room-item__info">
        <strong>{title}</strong>
        {children}
      </div>
      {action}
    </div>
  );
}

function FormulaSlot({ icon, name, need, owned }: { icon: string; name: string; need: number; owned?: number }) {
  const short = owned != null && owned < need;
  return (
    <figure className="mansion-room-formula__slot" data-short={short || undefined}>
      <ItemSlotStatic icon={icon} name={name} quantity={need} showRarity={false} size={58} />
      <figcaption>
        {name}
        {owned != null && <small>持有 {owned}</small>}
      </figcaption>
    </figure>
  );
}

/* ============ 运作页 ============ */

export function MansionFacilityOperation({ view, room, icons, busy, onCommand, onStock }: FacilitySectionProps & {
  onStock: () => void;
}) {
  const [requested, setRequested] = useState(1);
  const locked = busy || !!view.blocked;
  const roomGlyph = FACILITY_ROOM_GLYPHS[room.id] ?? crateGlyph;
  const action = (label: string, command: FacilityCommand, disabled = false) => (
    <RpgNotchedPillButton
      variant="teal"
      label={label}
      disabled={locked || disabled}
      onClick={() => onCommand(command)}
    />
  );
  const blocked = view.blocked ? <RoomNotice status glyph={bookGlyph}>请先完成当前剧情或远征。</RoomNotice> : null;
  const legacyRules = !room.build ? <p className="mansion-room-note">此旧档保留原设施规则</p> : null;

  if (!room.level) {
    if (room.build) {
      return <>{blocked}<RoomNotice glyph={hammerGlyph}>{room.name}尚未修缮。在「工程」完成首次修缮后即可运作。</RoomNotice></>;
    }
    return (
      <>
        {blocked}
        <RoomSection label="启用设施" glyph={roomGlyph}>
          <p className="mansion-room-note">第 {room.availableDay} 日可整理现有设备，启用{room.name}。</p>
          <div className="mansion-room-actions">
            {action("启用", { type: "facility-enable", roomId: room.id }, !room.canEnable)}
          </div>
        </RoomSection>
        {legacyRules}
      </>
    );
  }

  const batch = room.batch;
  const order = view.order;
  const recipe = view.recipes[0];
  const quantity = Math.min(requested, Math.max(1, recipe?.maximum ?? 1));
  const constructing = view.construction?.roomId === room.id;

  return (
    <>
      {blocked}
      {batch && (
        <RoomSection label="本批产出" glyph={roomGlyph} tone="production">
          <ItemLine
            slot={(
              <ItemSlotStatic
                icon={icons[batch.definitionId] ?? roomGlyph}
                name={batch.name}
                quantity={batch.remaining}
                unit={batch.kind === "material" ? "束" : "份"}
                showRarity={false}
                size={68}
              />
            )}
            title={batch.name}
          >
            <TimeLeft
              label="生产进度"
              total={batch.phases}
              remaining={batch.remainingPhases}
              done={batch.collectMaximum ? "已备妥，可收入储藏室" : "储藏室已满，本批保留待收"}
            />
          </ItemLine>
          <div className="mansion-room-actions">
            <p className="mansion-room-note">收完后开始下一批。</p>
            {action(
              batch.collectMaximum < batch.remaining && batch.collectMaximum > 0 ? `收取 ${batch.collectMaximum} 份` : "收取",
              { type: "facility-collect", roomId: room.id, batchId: batch.id, quantity: Math.max(1, batch.collectMaximum) },
              !batch.collectMaximum
            )}
          </div>
        </RoomSection>
      )}
      {room.id === "kitchen" && !batch && <RoomNotice glyph={watchGlyph}>暂无进行中的批次。</RoomNotice>}

      {room.id === "greenhouse" && (
        <RoomSection label="下一批种植" glyph={seedGlyph} tone="production">
          <div className="mansion-room-choices" role="group" aria-label="下一批种植">
            {view.projects.map((project) => {
              const chosen = view.state.selectedProject === project.id;
              return (
                <figure className="mansion-room-choice" key={project.id}>
                  <ItemSlot
                    icon={herbsGlyph}
                    name={project.name}
                    aria-label={project.name}
                    showRarity={false}
                    selected={chosen}
                    size={58}
                    disabled={locked}
                    onClick={() => { if (!chosen) onCommand({ type: "facility-plant", projectId: project.id }); }}
                  />
                  <figcaption>{project.name}</figcaption>
                </figure>
              );
            })}
          </div>
        </RoomSection>
      )}

      {room.id === "workshop" && (constructing ? (
        <RoomNotice glyph={hammerGlyph}>工坊施工中，完工后恢复加工。</RoomNotice>
      ) : order ? (
        <RoomSection label="加工订单" glyph={cauldronGlyph} tone="production">
          <ItemLine
            slot={(
              <ItemSlotStatic
                icon={icons[view.recipes.find((item) => item.id === order.recipeId)?.definitionId ?? ""] ?? cauldronGlyph}
                name={order.name}
                quantity={order.quantity}
                showRarity={false}
                size={68}
              />
            )}
            title={order.name}
          >
            <TimeLeft
              label="加工进度"
              total={view.recipes.find((item) => item.id === order.recipeId)?.phases ?? order.remainingPhases}
              remaining={order.remainingPhases}
              done="制作完成，储藏室已预留位置"
            />
          </ItemLine>
          <div className="mansion-room-actions">
            {action("领取", { type: "facility-claim", orderId: order.id }, !!order.remainingPhases)}
          </div>
        </RoomSection>
      ) : recipe && (
        <RoomSection label="加工配方" glyph={cauldronGlyph}>
          <div className="mansion-room-formula">
            {recipe.materials.map((material, index) => (
              <Fragment key={material.id}>
                {index > 0 && <span className="mansion-room-formula__op" aria-hidden="true">+</span>}
                <FormulaSlot
                  icon={icons[material.id] ?? herbsGlyph}
                  name={material.name}
                  need={material.quantity * quantity}
                  owned={material.owned}
                />
              </Fragment>
            ))}
            <svg className="mansion-room-arrow" viewBox="0 0 28 12" aria-hidden="true">
              <path d="M1 6 H24 M18 1 L25 6 L18 11" />
            </svg>
            <FormulaSlot icon={icons[recipe.definitionId] ?? cauldronGlyph} name={recipe.name} need={quantity} />
          </div>
          {!recipe.maximum && (
            <RoomNotice>
              {recipe.materials.some((material) => material.owned < material.quantity)
                ? "原料不足，请先收取温室药草。"
                : "辅料费不足或储藏室没有空位。"}
            </RoomNotice>
          )}
          {/* 与工程页同一条操作栏:左侧代价(工期、辅料费),右侧数量与确认。 */}
          <div className="mansion-room-actions">
            <span className="mansion-room-cost">
              <span><ManorGlyph className="mansion-room-glyph" src={watchGlyph} />{recipe.phases} 个时段</span>
              <span>
                <small>辅料</small>
                <CurrencyAmount value={recipe.fee * quantity} label="辅料费" />
              </span>
            </span>
            <QuantityStepper label="加工数量" value={quantity} maximum={recipe.maximum} disabled={locked} onChange={setRequested} />
            {action("加工", { type: "facility-craft", recipeId: recipe.id, quantity }, !recipe.maximum)}
          </div>
        </RoomSection>
      ))}

      {room.id === "storage" && (
        <RoomSection label="储藏" glyph={crateGlyph}>
          <div className="mansion-room-stock">
            <figure className="mansion-room-stock__cell">
              <ItemSlotStatic tone="interface" icon={backpackGlyph} name="出征补给" quantity={view.itemLimit} unit="类" size={58} />
              <figcaption>出征补给<small>{view.itemLimit} 类</small></figcaption>
            </figure>
            {view.materials.map((material) => (
              <figure className="mansion-room-stock__cell" key={material.id}>
                <ItemSlotStatic
                  icon={icons[material.id] ?? herbsGlyph}
                  name={material.name}
                  quantity={material.quantity}
                  unit="束"
                  showRarity={false}
                  size={58}
                />
                <figcaption>{material.name}<small>{material.quantity} / {material.capacity}</small></figcaption>
              </figure>
            ))}
          </div>
          <div className="mansion-room-actions">
            <p className="mansion-room-note">每种补给的数量由行囊上限决定。</p>
            <RpgNotchedPillButton variant="teal" label="查看库存" onClick={onStock} />
          </div>
        </RoomSection>
      )}
      {room.id === "storage" && view.overflow.length > 0 && (
        <RoomSection label="待入库" glyph={woodenCrateGlyph}>
          {view.overflow.map((item) => (
            <ItemLine
              key={item.id}
              slot={<ItemSlotStatic icon={icons[item.id] ?? crateGlyph} name={item.name} quantity={item.quantity} showRarity={false} size={58} />}
              title={item.name}
              action={action("入库", { type: "facility-store-return", definitionId: item.id, quantity: Math.max(1, item.maximum) }, !item.maximum)}
            >
              <span className="mansion-room-note">×{item.quantity} 等待空位</span>
            </ItemLine>
          ))}
        </RoomSection>
      )}

      {room.id === "maid" && (
        <RoomSection label="工程折扣" glyph={coinsGlyph}>
          <ItemLine
            slot={<ItemSlotStatic tone="interface" icon={needleGlyph} name="工程折扣" size={58} />}
            title={<>修缮与升级费用 <b className="mansion-room-figure">−{view.discount}%</b></>}
          >
            <span className="mansion-room-note">不含女仆工作间自身。</span>
          </ItemLine>
        </RoomSection>
      )}
      {legacyRules}
    </>
  );
}

/* ============ 工程页 ============ */

export function MansionFacilityWorks({ view, room, busy, onCommand }: FacilitySectionProps) {
  const build = room.build;
  const funding = view.funding;
  if (!build || !funding) return null;
  const locked = busy || !!view.blocked;
  const project = view.construction?.roomId === room.id ? view.construction : null;
  const quote = build.quote;
  const roomGlyph = FACILITY_ROOM_GLYPHS[room.id] ?? crateGlyph;
  const upgrade = room.level > 0;

  return (
    <>
      {project ? (
        <RoomSection
          label={project.fromLevel ? "升级中" : "修缮中"}
          emblem={<RoomEmblem tone="repair"><RepairIcon /></RoomEmblem>}
        >
          <TimeLeft
            label="施工进度"
            total={project.readyAt - project.startedAt}
            remaining={project.remainingPhases}
            done="即将完工"
          />
          <p className="mansion-room-note">
            完工后 Lv.{project.toLevel}{project.fromLevel && room.id !== "workshop" ? "，期间保留现有功能。" : "。"}
          </p>
        </RoomSection>
      ) : quote ? (
        <RoomSection
          label={upgrade ? `升级至 Lv.${quote.toLevel}` : "首次修缮"}
          emblem={upgrade
            ? <RoomEmblem tone="promote"><PromoteIcon /></RoomEmblem>
            : <RoomEmblem tone="repair"><RepairIcon /></RoomEmblem>}
        >
          {/* 标题已写明目标等级,头部也有等级菱形,这里只列「会变好什么」。 */}
          <div className="mansion-room-gains">
            {build.improvements.map((change) => (
              <div className="mansion-room-gain" key={change.label}>
                <ManorGlyph className="mansion-room-glyph" src={IMPROVEMENT_GLYPHS[change.label] ?? roomGlyph} />
                <span>{change.label}</span>
                <b>{`${change.before} → ${change.after}`}</b>
              </div>
            ))}
          </div>
          {build.reason && <RoomNotice status>{build.reason}</RoomNotice>}
          {/* 操作栏:左侧是代价(工期、公款),右侧是确认 —— 代价紧挨着确认键。 */}
          <div className="mansion-room-actions">
            <span className="mansion-room-cost">
              <span><ManorGlyph className="mansion-room-glyph" src={watchGlyph} />{quote.readyAt - view.now} 个时段</span>
              <span>
                <small>公款{build.discount ? ` · 已减 ${build.discount}%` : ""}</small>
                <CurrencyAmount value={quote.cost} label="公款支出" />
              </span>
            </span>
            <RpgNotchedPillButton
              variant="teal"
              label={upgrade ? "开始升级" : "开始修缮"}
              disabled={locked || !!build.reason}
              onClick={() => onCommand({ type: "facility-build", roomId: room.id, fromLevel: room.level, quotedCost: quote.cost })}
            />
          </div>
        </RoomSection>
      ) : (
        <RoomNotice status>{build.reason}</RoomNotice>
      )}

      <RoomSection label="公款" glyph={coinsGlyph}>
        <div className="mansion-room-ledger">
          <span className="mansion-room-ledger__title">公款结余</span>
          <CurrencyAmount value={funding.balance} label="公款结余" />
        </div>
        <p className="mansion-room-note">仅用于工程 · 下次拨款：第 {funding.nextDay} 日（周一）清晨</p>
      </RoomSection>
    </>
  );
}
