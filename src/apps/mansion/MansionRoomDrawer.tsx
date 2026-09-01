import type { RefObject } from "react";
import { CurrencyAmount } from "../../shared/ui/primitives/CurrencyAmount";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import type {
  MansionCharacter,
  MansionFund,
  MansionRoomDetail
} from "./data";
import { PRODUCTION_GLYPHS, RepairIcon } from "./MansionMarkers";
import { MansionRoomPreview, ResidentAvatar } from "./MansionRoomViews";
import { cleanRegionLabel, type DrawerSide, type SceneRegion } from "./mansion-geometry";
import {
  MAX_FACILITY_LEVEL,
  REPAIR_STEPS,
  promoteCost
} from "./mansion-state";

export type MansionRoomDrawerProps = {
  region: SceneRegion;
  detail: MansionRoomDetail;
  side: DrawerSide;
  inert: boolean | undefined;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  occupants: MansionCharacter[];
  level: number;
  upgradeRemaining: number | undefined;
  repairComplete: boolean;
  repairSteps: number;
  canPromote: boolean;
  funds: Record<MansionFund, number>;
  readyProduction: ReadonlySet<string>;
  onClose: () => void;
  onCollectProduction: (roomId: string) => void;
  onStartUpgrade: (roomId: string) => void;
  onPromoteFacility: (roomId: string) => void;
  onNavigate: (href: string) => void;
};

export function MansionRoomDrawer({
  region,
  detail,
  side,
  inert,
  closeButtonRef,
  occupants,
  level,
  upgradeRemaining,
  repairComplete,
  repairSteps,
  canPromote,
  funds,
  readyProduction,
  onClose,
  onCollectProduction,
  onStartUpgrade,
  onPromoteFacility,
  onNavigate
}: MansionRoomDrawerProps) {
  const roomName = cleanRegionLabel(region.label);
  const productionReady = readyProduction.has(region.id);

  return (
    <aside
      className="mansion-room-drawer"
      data-side={side}
      data-no-pan
      role="dialog"
      aria-modal="false"
      aria-labelledby={`mansion-room-title-${region.id}`}
      inert={inert}
      aria-hidden={inert}
    >
      <IconButton
        ref={closeButtonRef}
        className="mansion-room-card__close"
        label="关闭房间详情"
        icon="close"
        size="sm"
        onClick={onClose}
      />
      <RpgFrame className="mansion-room-card" padding="md" variant="dark">
        <div className="mansion-room-card__hero">
          <MansionRoomPreview region={region} label={roomName} />
          <div className="mansion-room-card__identity">
            <small>{detail.subtitle}</small>
            <h2 id={`mansion-room-title-${region.id}`}>{roomName}</h2>
            <div className="mansion-room-card__residents">
              <span>当前驻在</span>
              {occupants.length ? (
                <div
                  className="mansion-room-card__resident-list"
                  role="list"
                  aria-label="当前驻在角色"
                >
                  {occupants.map((character) => (
                    <ResidentAvatar key={character.id} character={character} />
                  ))}
                </div>
              ) : (
                <small className="mansion-room-card__resident-empty">无人驻在</small>
              )}
            </div>
          </div>
        </div>

        {detail.state === "sealed" && (
          <div className="mansion-room-card__warning">最高禁约 · 仅可查看封印状态</div>
        )}
        {detail.state === "provisional" && (
          <div className="mansion-room-card__provisional">美术补充区域 · 正式设定待确认</div>
        )}

        <div className="mansion-room-card__brief">
          <small>房间职能</small>
          <p className="mansion-room-card__description">{detail.description}</p>
        </div>

        <div className="mansion-room-card__trace">
          <small><i aria-hidden="true" />生活痕迹</small>
          <p>{detail.trace}</p>
        </div>

        {detail.production && (
          <div className="mansion-room-card__harvest">
            <small>本相位产出</small>
            <button
              type="button"
              className="mansion-room-card__collect"
              data-ready={productionReady || undefined}
              aria-label={productionReady
                ? `收取${detail.production.label} ${detail.production.amount}${detail.production.unit}`
                : `${detail.production.label}本相位已收取`}
              disabled={!productionReady}
              onClick={() => onCollectProduction(region.id)}
            >
              <i
                className="mansion-room-card__collect-glyph"
                style={{
                  WebkitMaskImage: `url("${PRODUCTION_GLYPHS[detail.production.icon]}")`,
                  maskImage: `url("${PRODUCTION_GLYPHS[detail.production.icon]}")`
                }}
                aria-hidden="true"
              />
              <span className="mansion-room-card__collect-name">{detail.production.label}</span>
              <span className="mansion-room-card__collect-amount">
                ×{detail.production.amount}<i>{detail.production.unit}</i>
              </span>
              <span className="mansion-room-card__collect-state">
                {productionReady ? "收取" : "已收"}
              </span>
            </button>
          </div>
        )}

        {detail.state !== "sealed" && detail.state !== "provisional" && (
          <div className="mansion-room-card__tier" role="group" aria-label="设施状态">
            <span className="mansion-room-card__tier-label">设施档位</span>
            <span
              className="mansion-room-card__tier-track"
              role="progressbar"
              aria-label={`设施档位 · Lv.${level}`}
              aria-valuemin={1}
              aria-valuemax={MAX_FACILITY_LEVEL}
              aria-valuenow={level}
            >
              {Array.from({ length: MAX_FACILITY_LEVEL }, (_, index) => (
                <i key={index} data-on={index < level || undefined} />
              ))}
            </span>
            <span className="mansion-room-card__tier-value" aria-hidden="true">
              <em>Lv</em><b>{level}</b><s>/ {MAX_FACILITY_LEVEL}</s>
            </span>

            {!repairComplete && (
              <>
                <span className="mansion-room-card__tier-label" data-sub="">
                  修缮进度
                </span>
                <span
                  className="mansion-room-card__tier-track"
                  data-sub=""
                  role="progressbar"
                  aria-label={`修缮进度 ${repairSteps}/${REPAIR_STEPS}`}
                  aria-valuemin={0}
                  aria-valuemax={REPAIR_STEPS}
                  aria-valuenow={repairSteps}
                >
                  {Array.from({ length: REPAIR_STEPS }, (_, index) => (
                    <i
                      key={index}
                      data-on={index < repairSteps || undefined}
                      data-busy={
                        index === repairSteps && upgradeRemaining ? "" : undefined
                      }
                    />
                  ))}
                </span>
                <span
                  className="mansion-room-card__tier-value"
                  data-sub=""
                  aria-hidden="true"
                >
                  <b>{repairSteps}</b><s>/ {REPAIR_STEPS}</s>
                </span>
              </>
            )}
          </div>
        )}

        {(detail.upgradeCost || (detail.href && detail.actionLabel)) && (
          <div className="mansion-room-card__footer">
            <div className="mansion-room-card__actions">
              {detail.upgradeCost && detail.fund && canPromote && (
                <button
                  type="button"
                  className="mansion-room-card__promote"
                  aria-label={`升级至 Lv.${level + 1}，花费 ${promoteCost(detail.upgradeCost)} 金币`}
                  disabled={funds[detail.fund] < promoteCost(detail.upgradeCost)}
                  onClick={() => onPromoteFacility(region.id)}
                >
                  <span className="mansion-room-card__promote-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 4 L12 20" />
                      <path d="M5 11 L12 4 L19 11" />
                    </svg>
                  </span>
                  <strong>升级建筑</strong>
                  <CurrencyAmount
                    value={promoteCost(detail.upgradeCost)}
                    label={`金币 ${promoteCost(detail.upgradeCost)}`}
                  />
                </button>
              )}
              {detail.upgradeCost && detail.fund && !canPromote && (
                <button
                  type="button"
                  className="mansion-room-card__repair"
                  aria-label={upgradeRemaining
                    ? `修缮中，还需 ${upgradeRemaining} 相位`
                    : repairComplete
                      ? `修缮已完成，Lv.${MAX_FACILITY_LEVEL}`
                      : `修缮，花费 ${detail.upgradeCost} 金币`}
                  disabled={Boolean(upgradeRemaining) || repairComplete}
                  onClick={() => onStartUpgrade(region.id)}
                >
                  <span className="mansion-room-card__repair-icon"><RepairIcon /></span>
                  <strong>{upgradeRemaining ? "施工中" : repairComplete ? "已满档" : "修缮"}</strong>
                  {upgradeRemaining ? (
                    <small>{upgradeRemaining} 相位</small>
                  ) : repairComplete ? (
                    <small>Lv.{MAX_FACILITY_LEVEL}</small>
                  ) : (
                    <CurrencyAmount
                      value={detail.upgradeCost}
                      label={`金币 ${detail.upgradeCost}`}
                    />
                  )}
                </button>
              )}
              {detail.href && detail.actionLabel && (
                <RpgNotchedPillButton
                  className="mansion-room-card__action"
                  variant="teal"
                  label={detail.actionLabel}
                  onClick={() => onNavigate(detail.href!)}
                />
              )}
            </div>
          </div>
        )}
      </RpgFrame>
    </aside>
  );
}
