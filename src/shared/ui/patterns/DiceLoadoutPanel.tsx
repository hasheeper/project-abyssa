import { useRef, useState } from "react";
import type {
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from "react";
import { cx } from "../../lib/cx";
import { ExpeditionDieCube } from "../dice-face/ExpeditionDieCube";
import type {
  ExpeditionDieFaceConfig,
  ExpeditionDieRotation
} from "../dice-face/ExpeditionDieCube";
import { ExpeditionFlatDieFrame } from "../dice-face/ExpeditionFlatDieFrame";
import { ItemSlot } from "../primitives/ItemSlot";
import { RpgFrame } from "../primitives/RpgFrame";
import broadswordIcon from "../../../assets/svg/items/game-icons/broadsword.svg";
import swapBagIcon from "../../../assets/svg/items/game-icons/swap-bag.svg";
import splitCrossIcon from "../../../assets/svg/6-0-split-cross.svg";
import crossShieldIcon from "../../../assets/svg/ui/game-icon-cross-shield.svg";
import hospitalCrossIcon from "../../../assets/svg/ui/game-icon-hospital-cross.svg";
import magicPalmIcon from "../../../assets/svg/ui/game-icon-magic-palm.svg";
import slashedShieldIcon from "../../../assets/svg/ui/slashed-shield.svg";
import scrollIcon from "../../../assets/svg/items/game-icons/scroll-unfurled.svg";
import ringIcon from "../../../assets/svg/items/game-icons/diamond-ring.svg";
import bookIcon from "../../../assets/svg/items/game-icons/spell-book.svg";
import {
  CHARM_KIND_LABELS,
  CHARM_SLOT_COUNT,
  DIE_FACE_ACTION_LABELS,
  DIE_FATE_STATE_LABELS,
  DIE_SUIT_LABELS,
  DIE_SUIT_SHAPES,
  awakeFaces,
  countSuit,
  fateEntersHand
} from "../../domain/dice/face";
import type {
  CharacterDiceLoadout,
  DieCharm,
  DieFace
} from "../../domain/dice/face";
import { DICE_NET_PLACEMENTS } from "./diceLoadoutGeometry";

/* ============ 骰装页 ============
 *
 * 参考稿式三栏布局 + 点选检视:
 *   左栏 = 三个挂坠位(点挂坠)
 *   右上 = 命骰十字网(点骰面) + 可拖动的六面合骰
 *   右下 = 检视栏
 *
 * 复用而非重造:
 *   RpgFrame           命骰区与检视栏外框(自带分层描边 + 四角 + 水印)
 *   ExpeditionFlatDieFrame  骰面本体(280 viewBox 精细件)
 *   ItemSlot           挂坠格(六层堆叠 + 空槽凹孔 + mask 图标着色)
 *
 * 图标一律走 mask-image 的 SVG 资源,**禁 emoji 与文字符号**;
 * 动作图标与 ExpeditionFlatDieFrame 的 STAMP_ICONS 同源,
 * 否则同一动作在骰面上和检视栏里会长成两个样子。
 */

const ACTION_ICONS = {
  attack: broadswordIcon,
  guard: crossShieldIcon,
  heal: hospitalCrossIcon,
  coin: swapBagIcon,
  art: magicPalmIcon,
  wild: splitCrossIcon,
  blank: slashedShieldIcon
} as const;

const CHARM_ICONS = {
  ...ACTION_ICONS,
  scroll: scrollIcon,
  ring: ringIcon,
  book: bookIcon
} as const;

/** 挂坠类别决定稀有度色带:战面改写偏金,命数修正偏紫。 */
const CHARM_RARITY = {
  "combat-face": "gold",
  fate: "amethyst"
} as const;

type Inspection =
  | { kind: "overview" }
  | { kind: "face"; face: DieFace }
  | { kind: "charm"; charm: DieCharm }
  | { kind: "vacant" };

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"] as const;
const PREVIEW_TEXTURE_ROTATIONS = [0, 90, 180, 270, 90, 180] as const;

type CubeDragState = {
  active: boolean;
  x: number;
  y: number;
};

/** 花色底板。纯几何,与骰面左上角的 suit plate 同形。 */
function SuitGlyph({ suit }: { suit: DieFace["suit"] }) {
  return (
    <i
      className="abyssa-dice__cell-suit"
      data-plate={DIE_SUIT_SHAPES[suit]}
      data-suit={suit}
      aria-hidden="true"
    />
  );
}

/** mask 图标的行内样式。图标一律走 mask,不用 <img> —— 才能被令牌色着色。 */
function maskStyle(icon: string) {
  return {
    WebkitMaskImage: `url("${icon}")`,
    maskImage: `url("${icon}")`
  };
}

export interface DiceLoadoutPanelProps extends HTMLAttributes<HTMLDivElement> {
  loadout?: CharacterDiceLoadout;
  characterName?: string;
  themeColor?: string;
}

/* 一格数据。标签在上、值在下,不再是「标签 + 冒号 + 值」的窄行 ——
   检视栏是 580x233 的宽扁框,竖着排窄行会把宽度全浪费掉。
   span=2 的格子跨满整行,给私约/轶闻这类长句用。 */
function Cell({
  label,
  children,
  wide,
  tone,
  icon,
  glyph
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
  tone?: "accent" | "gold";
  /** mask 图标(SVG 资源)。 */
  icon?: string;
  /** 纯几何标记,例如花色底板。 */
  glyph?: React.ReactNode;
}) {
  return (
    <div className="abyssa-dice__cell-data" data-wide={wide || undefined} data-tone={tone}>
      <b>
        {icon && <i className="abyssa-dice__cell-icon" style={maskStyle(icon)} aria-hidden="true" />}
        {glyph}
        {label}
      </b>
      <span>{children}</span>
    </div>
  );
}

/* 检视栏统一骨架:左侧身份铭牌 + 右侧数据网格。 */
function Plate({
  kicker,
  owner,
  title,
  titleAccent,
  sub,
  pip,
  strip,
  children,
  foot
}: {
  kicker: string;
  /** 归属前缀（「艾比希斯的」）。单独一行小字 ——
      与大标题挤在一行会超出铭牌 168px 的可用宽。 */
  owner?: string;
  title: React.ReactNode;
  titleAccent?: string;
  sub?: string;
  /** 点数。给出时在铭牌上方画一枚传统白骰 —— 比数字直观。 */
  pip?: number;
  /** 六面点数缩略图。总览态没有单一点数,用它填掉白骰的位置,
      否则铭牌下方会空出 65px 死白（就是「根本没展开」）。 */
  strip?: { pip: number; awake: boolean }[];
  children?: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <>
      <div className="abyssa-dice__ident">
        <div className="abyssa-dice__ident-head">
          {pip !== undefined && (
            <span
              className="abyssa-dice__die"
              data-pip={pip}
              role="img"
              aria-label={`点数 ${pip}`}
            />
          )}
          {strip && (
            <span
              className="abyssa-dice__strip"
              role="img"
              aria-label={`六面点数 ${strip.map((f) => f.pip).join(" ")}`}
            >
              {strip.map((face, index) => (
                <i
                  key={index}
                  className="abyssa-dice__die"
                  data-pip={face.pip}
                  data-asleep={face.awake ? undefined : true}
                />
              ))}
            </span>
          )}
          <div className="abyssa-dice__ident-text">
            <span className="abyssa-dice__kicker">{kicker}</span>
            {owner && <span className="abyssa-dice__owner">{owner}</span>}
            <h3>
              {title && <span>{title}</span>}
              {titleAccent && <em>{titleAccent}</em>}
            </h3>
            {sub && <p className="abyssa-dice__sub">{sub}</p>}
          </div>
        </div>
        {foot && <p className="abyssa-dice__foot">{foot}</p>}
      </div>
      <div className="abyssa-dice__data">{children}</div>
    </>
  );
}

function DiceCubePreview({
  faces,
  themeColor
}: {
  faces: DieFace[];
  themeColor?: string;
}) {
  const [rotation, setRotation] = useState<ExpeditionDieRotation>({ x: -18, y: 28 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<CubeDragState>({ active: false, x: 0, y: 0 });
  const cubeFaces: ExpeditionDieFaceConfig[] = faces.map((face) => {
    const awake = fateEntersHand(face.fate);
    return {
      number: face.face,
      fate: face.pip,
      power: face.power,
      seal: awake ? "plain" : "none",
      action: face.action,
      textureRotation: PREVIEW_TEXTURE_ROTATIONS[face.face - 1] ?? 0,
      suitShape: DIE_SUIT_SHAPES[face.suit],
      wildPip: face.wildPip,
      scoring: awake
    };
  });

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    drag.current = { active: true, x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    setRotation((current) => ({
      x: Math.max(-78, Math.min(78, current.x - deltaY * 0.55)),
      y: current.y + deltaX * 0.55
    }));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function rotateFromKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = 12;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    setRotation((current) => ({
      x: Math.max(
        -78,
        Math.min(78, current.x + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0))
      ),
      y: current.y + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0)
    }));
  }

  return (
    <aside className="abyssa-dice__cube-preview" aria-label="3D 六面命骰预览">
      <header className="abyssa-dice__cube-title">
        <span>ASSEMBLED</span>
        <b>六面合骰</b>
      </header>
      <div
        className="abyssa-dice__cube-scene"
        data-dragging={dragging || undefined}
        data-rotation-x={rotation.x}
        data-rotation-y={rotation.y}
        role="img"
        aria-label="六面命骰，可拖动或使用方向键旋转"
        tabIndex={0}
        onKeyDown={rotateFromKeyboard}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="abyssa-dice__cube-spin" data-paused={dragging || undefined}>
          <ExpeditionDieCube
            className="abyssa-dice__preview-cube"
            faces={cubeFaces}
            rotation={rotation}
            size={96}
            recessDepth={2}
            dragging={dragging}
            themeColor={themeColor}
          />
        </div>
      </div>
      <span className="abyssa-dice__cube-hint" aria-hidden="true">拖动旋转</span>
    </aside>
  );
}

function InspectorBody({
  inspection,
  loadout,
  characterName
}: {
  inspection: Inspection;
  loadout: CharacterDiceLoadout;
  characterName?: string;
}) {
  if (inspection.kind === "overview") {
    const awake = awakeFaces(loadout.faces).length;
    const asleep = loadout.faces.length - awake;

    return (
      <Plate
        kicker="ARCHIVE · 总览"
        owner={characterName ? `${characterName}的` : undefined}
        title=""
        titleAccent="命骰"
        sub="FATE DIE"
        strip={[...loadout.faces]
          .sort((a, b) => a.face - b.face)
          .map((face) => ({ pip: face.pip, awake: fateEntersHand(face.fate) }))}
        foot="点击骰面或挂坠查看细节"
      >
        {loadout.primarySuit && (
          <Cell label="主色" glyph={<SuitGlyph suit={loadout.primarySuit} />}>
            <i data-suit={loadout.primarySuit}>
              {DIE_SUIT_LABELS[loadout.primarySuit]}
            </i>
            <s>{countSuit(loadout.faces, loadout.primarySuit)} 面</s>
          </Cell>
        )}
        {loadout.secondarySuit && (
          <Cell label="副色" glyph={<SuitGlyph suit={loadout.secondarySuit} />}>
            <i data-suit={loadout.secondarySuit}>
              {DIE_SUIT_LABELS[loadout.secondarySuit]}
            </i>
            <s>{countSuit(loadout.faces, loadout.secondarySuit)} 面</s>
          </Cell>
        )}
        <Cell label="已醒" tone="gold" glyph={<i className="abyssa-dice__cell-seal" data-seal="plain" aria-hidden="true" />}>
          {awake}
          <s>/ 6</s>
        </Cell>
        <Cell label="沉眠" glyph={<i className="abyssa-dice__cell-seal" data-seal="none" aria-hidden="true" />}>
          {asleep}
          <s>/ 6</s>
        </Cell>
        {loadout.pact && (
          <Cell label="私约" wide tone="accent" icon={scrollIcon}>
            {loadout.pact}
          </Cell>
        )}
      </Plate>
    );
  }

  if (inspection.kind === "face") {
    const { face } = inspection;
    const awake = fateEntersHand(face.fate);
    const charm = loadout.charms?.find((item) => item.id === face.chamedBy);

    if (!awake) {
      return (
        <Plate
          kicker="FACE · 沉眠"
          title={`第 ${face.face} 面`}
          sub="STILL ASLEEP"
          foot="它在等什么，无人知晓"
        >
          <Cell
            label="状态"
            wide
            glyph={<i className="abyssa-dice__cell-seal" data-seal="none" aria-hidden="true" />}
          >
            刻痕被漫长的岁月磨平，点数不参与任何牌型。
          </Cell>
        </Plate>
      );
    }

    return (
      <Plate
        kicker={`FACE · 第 ${face.face} 面`}
        title={DIE_FACE_ACTION_LABELS[face.action]}
        titleAccent={String(face.power)}
        sub={`SPECIMEN · ${ROMAN[face.face]}`}
        pip={face.pip}
        foot={face.note}
      >
        <Cell
          label="战面"
          icon={ACTION_ICONS[face.action]}
          tone={face.basePower !== undefined ? "accent" : undefined}
        >
          {face.power}
          {face.basePower !== undefined && <s>原 {face.basePower}</s>}
        </Cell>
        <Cell label="花色" glyph={<SuitGlyph suit={face.suit} />}>
          <i data-suit={face.suit}>{DIE_SUIT_LABELS[face.suit]}</i>
        </Cell>
        <Cell
          label="铭"
          glyph={<i className="abyssa-dice__cell-seal" data-seal="plain" aria-hidden="true" />}
        >
          素铭
        </Cell>
        <Cell label="命数" tone="gold">
          {face.pip}
          <s>{DIE_FATE_STATE_LABELS[face.fate]}</s>
        </Cell>
        {charm && (
          <Cell label="改写" wide tone="accent" icon={CHARM_ICONS[charm.icon]}>
            由【{charm.name}】供给，卸下即还原
          </Cell>
        )}
      </Plate>
    );
  }

  if (inspection.kind === "charm") {
    const { charm } = inspection;

    return (
      <Plate
        kicker="CHARM · 挂坠"
        title={charm.name}
        sub={charm.secondaryName}
        foot={charm.lore}
      >
        <Cell label="效果" wide tone="accent" icon={CHARM_ICONS[charm.icon]}>
          {charm.effect}
        </Cell>
        <Cell label="类别" icon={charm.kind === "combat-face" ? broadswordIcon : ringIcon}>
          {CHARM_KIND_LABELS[charm.kind]}
        </Cell>
        {charm.origin && <Cell label="来源" icon={swapBagIcon}>{charm.origin}</Cell>}
      </Plate>
    );
  }

  return (
    <Plate kicker="CHARM · 空之位" title="虚位以待" sub="VACANT">
      <Cell label="状态" wide icon={slashedShieldIcon}>
        尚未悬挂任何饰品。去缇比的货架上看看吧。
      </Cell>
    </Plate>
  );
}

export function DiceLoadoutPanel({
  loadout,
  characterName,
  themeColor,
  className,
  ...props
}: DiceLoadoutPanelProps) {
  const [inspection, setInspection] = useState<Inspection>({ kind: "overview" });
  const faces = loadout?.faces ?? [];

  /* 占位态:引擎目前只认五人,档案九人里有五人一面骰都没有。
     宁可明说「未编入远征」,也不渲染一副假骰子。 */
  if (faces.length === 0) {
    return (
      <div className={cx("abyssa-dice", className)} data-placeholder="true" {...props}>
        <RpgFrame className="abyssa-dice__placeholder-frame" padding="lg">
          <div className="abyssa-dice__placeholder" role="note">
            <i
              className="abyssa-dice__placeholder-glyph"
              style={{
                WebkitMaskImage: `url("${slashedShieldIcon}")`,
                maskImage: `url("${slashedShieldIcon}")`
              }}
              aria-hidden="true"
            />
            <strong>未编入远征</strong>
            <p>{loadout?.placeholderNote ?? "尚未编入远征队列"}</p>
          </div>
        </RpgFrame>
      </div>
    );
  }

  const byFace = new Map(faces.map((face) => [face.face, face]));
  const charms = loadout?.charms ?? [];

  const charmMask = (charmId: string) => {
    const icon = charms.find((charm) => charm.id === charmId)?.icon ?? "scroll";
    return {
      WebkitMaskImage: `url("${CHARM_ICONS[icon]}")`,
      maskImage: `url("${CHARM_ICONS[icon]}")`
    };
  };

  const selectedFace = inspection.kind === "face" ? inspection.face.face : undefined;
  const selectedCharm = inspection.kind === "charm" ? inspection.charm.id : undefined;

  return (
    <div className={cx("abyssa-dice", className)} {...props}>
      <div className="abyssa-dice__stage">
        {/* ===== 右上:命骰十字网 ===== */}
        <RpgFrame className="abyssa-dice__net-frame" padding="sm">
        <div className="abyssa-dice__net-inner">
          {/* 左上角标题栏。 */}
          <div className="abyssa-dice__band-title">
            <span className="abyssa-dice__band-kicker">FATE DIE</span>
            <b>命骰{characterName ? ` · ${characterName}` : ""}</b>
          </div>

          <div className="abyssa-dice__net-body">
            <section className="abyssa-dice__net" aria-label="命骰六面">
              {DICE_NET_PLACEMENTS.map((placement) => {
              const face = byFace.get(placement.face);
              if (!face) return null;
              const isAwake = fateEntersHand(face.fate);
              const selected = selectedFace === face.face;

              return (
                <button
                  type="button"
                  className="abyssa-dice__column"
                  style={{
                    gridColumn: placement.column,
                    gridRow: placement.row
                  }}
                  key={placement.face}
                  data-face={face.face}
                  data-fate={face.fate}
                  data-selected={selected || undefined}
                  aria-pressed={selected}
                  aria-label={`第 ${face.face} 面，${
                    isAwake
                      ? `${DIE_FACE_ACTION_LABELS[face.action]} ${face.power}，命数 ${face.pip}，${DIE_SUIT_LABELS[face.suit]}`
                      : "沉眠"
                  }`}
                  onClick={() => setInspection({ kind: "face", face })}
                >
                  <span className="abyssa-dice__cell">
                    <ExpeditionFlatDieFrame
                      action={face.action}
                      fate={face.pip}
                      power={face.power}
                      seal={isAwake ? "plain" : "none"}
                      suitShape={DIE_SUIT_SHAPES[face.suit]}
                      themeColor={themeColor}
                      wildPip={face.wildPip}
                      scoring={isAwake}
                      recessDepth={2}
                      label=""
                    />
                    {face.chamedBy && (
                      <span className="abyssa-dice__pin" aria-hidden="true">
                        <i style={charmMask(face.chamedBy)} />
                      </span>
                    )}
                  </span>

                </button>
              );
              })}
            </section>
            <DiceCubePreview faces={faces} themeColor={themeColor} />
          </div>
        </div>
        </RpgFrame>

        {/* display:contents 只保留语义分组；子项参与外层版面。 */}
        <div className="abyssa-dice__lower">
          <div className="abyssa-dice__charms" role="group" aria-label="饰品挂坠">
              {Array.from({ length: CHARM_SLOT_COUNT }, (_, index) => {
                const charm = charms[index];

                if (!charm) {
                  return (
                    <div className="abyssa-dice__charm" data-empty="true" key={index}>
                      <span className="abyssa-dice__hook" aria-hidden="true" />
                      <div className="abyssa-dice__charm-token">
                        <span className="abyssa-dice__charm-backdrop" aria-hidden="true" />
                        <span className="abyssa-dice__charm-medallion">
                          <ItemSlot
                            size={52}
                            showRarity={false}
                            /* 不传 name:ItemSlot 会把稀有度拼进无障碍名(「凡品」),
                               空插孔不该有稀有度。显式 aria-label 覆盖它自算的名字。 */
                            aria-label={`挂坠位 ${index + 1} 空`}
                            aria-pressed={inspection.kind === "vacant"}
                            data-selected={inspection.kind === "vacant" || undefined}
                            onClick={() => setInspection({ kind: "vacant" })}
                          />
                        </span>
                        <span className="abyssa-dice__charm-name">
                          <span className="abyssa-dice__charm-name-inner">
                            <span className="abyssa-dice__charm-name-text">空之位</span>
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    className="abyssa-dice__charm abyssa-rarity"
                    data-rarity={CHARM_RARITY[charm.kind]}
                    key={charm.id}
                  >
                    <span className="abyssa-dice__hook" aria-hidden="true" />
                    <div className="abyssa-dice__charm-token">
                      <span className="abyssa-dice__charm-backdrop" aria-hidden="true" />
                      <span className="abyssa-dice__charm-medallion">
                        <ItemSlot
                          icon={CHARM_ICONS[charm.icon]}
                          name={charm.name}
                          rarity={CHARM_RARITY[charm.kind]}
                          size={52}
                          showRarity={false}
                          aria-pressed={selectedCharm === charm.id}
                          data-selected={selectedCharm === charm.id || undefined}
                          onClick={() => setInspection({ kind: "charm", charm })}
                        />
                      </span>
                      <span className="abyssa-dice__charm-name">
                        <span className="abyssa-dice__charm-name-inner">
                          <span className="abyssa-dice__charm-name-text">
                            {charm.name}
                          </span>
                        </span>
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <RpgFrame className="abyssa-dice__inspector" padding="sm">
            <div className="abyssa-dice__plate">
              {/* 内容可能长过槽位(轶闻、私约),所以正文自己滚动,
                  绝不让容器被内容顶破。 */}
              <div className="abyssa-dice__plate-scroll" tabIndex={0} aria-live="polite">
                {loadout && (
                  <InspectorBody
                    inspection={inspection}
                    loadout={loadout}
                    characterName={characterName}
                  />
                )}
              </div>
            </div>
          </RpgFrame>
        </div>
      </div>
    </div>
  );
}
