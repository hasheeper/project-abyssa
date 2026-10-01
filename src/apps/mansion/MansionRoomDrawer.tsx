import { useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import type { FacilityCommand } from "../../game-core/contracts/facilities";
import type { FacilitiesView } from "../../game-runtime/facilities-view";
import { IconButton } from "../../shared/ui/primitives/IconButton";
import { RpgFacetDiamond } from "../../shared/ui/primitives/RpgFacetDiamond";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import type { MansionCharacter, MansionRoomDetail } from "./data";
import {
  FACILITY_ROOM_GLYPHS,
  FacilityGrade,
  Glyph,
  MansionFacilityOperation,
  MansionFacilityWorks,
  OVERVIEW_GLYPH,
  RoomNotice,
  RoomSection,
  TRACE_GLYPH,
  WORKS_GLYPH
} from "./MansionFacilitySections";
import { MansionRoomPreview, ResidentAvatar } from "./MansionRoomViews";
import { cleanRegionLabel, type DrawerSide, type SceneRegion } from "./mansion-geometry";

type RoomTab = "overview" | "operation" | "works";

const TAB_LABELS: Record<RoomTab, string> = { overview: "概况", operation: "运作", works: "工程" };

export type MansionRoomDrawerProps = {
  region: SceneRegion;
  detail: MansionRoomDetail;
  side: DrawerSide;
  inert: boolean | undefined;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  occupants: MansionCharacter[];
  /** 旧档没有设施视图:设施房间只给一条说明,不画档位与按钮。 */
  facilities: FacilitiesView | null;
  itemIcons: Readonly<Record<string, string>>;
  busy: boolean;
  productionReady: boolean;
  onFacilityCommand: (command: FacilityCommand) => void;
  onOpenStock: () => void;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

export function MansionRoomDrawer({
  region,
  detail,
  side,
  inert,
  closeButtonRef,
  occupants,
  facilities,
  itemIcons,
  busy,
  productionReady,
  onFacilityCommand,
  onOpenStock,
  onClose,
  onNavigate
}: MansionRoomDrawerProps) {
  const roomName = cleanRegionLabel(region.label);
  const room = facilities?.rooms.find((item) => item.id === region.id) ?? null;
  const tabs: RoomTab[] = !room ? ["overview"]
    : room.build && facilities?.funding ? ["overview", "operation", "works"]
    : ["overview", "operation"];
  const defaultTab: RoomTab = !room ? "overview" : !room.level && tabs.includes("works") ? "works" : "operation";
  /* 换房间时抽屉不重挂(否则重播入场动效),所以页签按房间记忆:
     换到别的房间即回到该房间的默认页。 */
  const [picked, setPicked] = useState<{ roomId: string; tab: RoomTab } | null>(null);
  const tab = picked && picked.roomId === region.id && tabs.includes(picked.tab) ? picked.tab : defaultTab;
  const tabbed = tabs.length > 1;
  const titleId = `mansion-room-title-${region.id}`;
  const panelId = `mansion-room-${region.id}-panel`;
  const tabId = (id: RoomTab) => `mansion-room-${region.id}-tab-${id}`;
  const tabGlyph = (id: RoomTab) => id === "overview" ? OVERVIEW_GLYPH
    : id === "works" ? WORKS_GLYPH
    : FACILITY_ROOM_GLYPHS[region.id];
  const choose = (next: RoomTab) => setPicked({ roomId: region.id, tab: next });
  /* 与 SystemTabs / 角色档案页签同一套键位:左右循环,Home/End 到两端。 */
  const moveTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : null;
    if (next === null) return;
    event.preventDefault();
    choose(tabs[next]);
    document.getElementById(tabId(tabs[next]))?.focus({ preventScroll: true });
  };

  return (
    <aside
      className="mansion-room-drawer manor-surface"
      data-side={side}
      data-no-pan
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
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
        <header className="mansion-room-card__hero">
          <MansionRoomPreview region={region} label={roomName} />
          <div className="mansion-room-card__identity">
            <small>{detail.subtitle}</small>
            <h2 id={titleId}>{roomName}</h2>
            {room && facilities && <FacilityGrade view={facilities} room={room} />}
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
        </header>

        {tabbed && (
          <div className="mansion-room-card__tabs" role="tablist" aria-label={`${roomName}分页`}>
            {tabs.map((id, index) => {
              const selected = tab === id;
              const ready = id === "operation" && productionReady;
              return (
                <button
                  type="button"
                  key={id}
                  id={tabId(id)}
                  className="mansion-room-tab"
                  role="tab"
                  data-selected={selected || undefined}
                  aria-selected={selected}
                  aria-controls={panelId}
                  aria-label={ready ? "运作 · 有可收取的成品" : undefined}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(id)}
                  onKeyDown={(event) => moveTab(event, index)}
                >
                  <Glyph src={tabGlyph(id)} />
                  <span>{TAB_LABELS[id]}</span>
                  {ready && <RpgFacetDiamond className="mansion-room-tab__ready" label="" state="current" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}

        <div
          className="mansion-room-card__body"
          id={panelId}
          role={tabbed ? "tabpanel" : undefined}
          aria-labelledby={tabbed ? tabId(tab) : undefined}
        >
          {tab === "overview" && (
            <RoomOverview
              detail={detail}
              legacyFacility={!facilities && (detail.production != null || detail.upgradeCost != null)}
            />
          )}
          {tab === "operation" && room && facilities && (
            <MansionFacilityOperation
              view={facilities}
              room={room}
              icons={itemIcons}
              busy={busy}
              onCommand={onFacilityCommand}
              onStock={onOpenStock}
            />
          )}
          {tab === "works" && room && facilities && (
            <MansionFacilityWorks view={facilities} room={room} icons={itemIcons} busy={busy} onCommand={onFacilityCommand} />
          )}
        </div>

        {detail.href && detail.actionLabel && (
          <footer className="mansion-room-card__footer">
            <RpgNotchedPillButton
              className="mansion-room-card__action"
              variant="teal"
              label={detail.actionLabel}
              disabled={detail.href.includes("dice")}
              onClick={() => onNavigate(detail.href!)}
            />
          </footer>
        )}
      </RpgFrame>
    </aside>
  );
}

function RoomOverview({ detail, legacyFacility }: { detail: MansionRoomDetail; legacyFacility: boolean }) {
  return (
    <>
      {detail.state === "sealed" && <RoomNotice tone="alert">最高禁约 · 仅可查看封印状态</RoomNotice>}
      {detail.state === "provisional" && <RoomNotice glyph={OVERVIEW_GLYPH}>美术补充区域 · 正式设定待确认</RoomNotice>}
      <RoomSection label="房间职能" glyph={OVERVIEW_GLYPH}>
        <p className="mansion-room-card__description">{detail.description}</p>
      </RoomSection>
      <RoomSection label="生活痕迹" glyph={TRACE_GLYPH}>
        <p className="mansion-room-card__trace">{detail.trace}</p>
      </RoomSection>
      {legacyFacility && <RoomNotice>建设与生产尚未开放</RoomNotice>}
    </>
  );
}
