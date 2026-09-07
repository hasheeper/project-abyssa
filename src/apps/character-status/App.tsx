import { useEffect, useMemo, useState } from "react";
import { AbyssaProvider } from "../../shared/ui/primitives/AbyssaProvider";
import { CharacterStatusScreen } from "../../shared/ui/patterns/CharacterStatusScreen";
import { StatusPanel } from "../../shared/ui/patterns/StatusPanel";
import { DiceLoadoutPanel } from "../../shared/ui/patterns/DiceLoadoutPanel";
import { CharacterChroniclePanel } from "../../shared/ui/patterns/CharacterChroniclePanel";
import { GameMenu } from "../../shared/ui/patterns/game-menu/GameMenu";
import { Stage } from "../../shared/stage";
import {
  ReadGameProvider,
  ReadGameGate,
  useReadSession,
  useReadState,
} from "../../game-client/read-react";
import {
  gameHref,
  parseCharacterLocation,
  parseLocator,
  type CharacterLocation,
} from "../../game-client/navigation";
import { presentCharacterArchive } from "../../game-client/character-presentation";
import type { CharacterArchiveView } from "../../game-runtime/character-views";
import { useEquipmentSession } from "../../game-client/use-equipment-session";
import { EQUIPMENT_COMMAND_POLICY } from "../../game-client/use-equipment-session";
import { CharacterMemoryEntry } from "../../game-client/CharacterMemoryEntry";
import { EquipmentEditor } from "../../game-client/EquipmentEditor";
import { DiceActionButton } from "../../shared/ui/patterns/action-dock/DiceActionButton";
import type { d5ProgressionView } from "../../game-runtime/d5-views";

const tabs = [
  { id: "summary", label: "概要" },
  { id: "dice", label: "骰装" },
  { id: "archive", label: "记事" },
];
const characterPolicy = {continueRuns: false as const, commandTypes: [...EQUIPMENT_COMMAND_POLICY.commandTypes, "begin-memory", "retry-memory", "inherit-memory"]};
export function App() {
  return (
    <ReadGameProvider>
      <ReadGameGate>
        <CharacterPage />
      </ReadGameGate>
    </ReadGameProvider>
  );
}
export function CharacterPage() {
  const session = useReadSession(),
    state = useReadState(),
    record = state.record!;
  const view = useMemo(
    () => session.runtime.queries.archive(record),
    [session, record],
  );
  const characters = useMemo(() => presentCharacterArchive(view), [view]);
  const equipment = useEquipmentSession(characterPolicy);
  const progression = useMemo(() => record.schemaVersion === 4 ? session.runtime.queries.progression(record) : null,[record,session]);
  return (
    <ArchiveScreen
      key={JSON.stringify([record.head.saveId, record.head.epoch])}
      view={view}
      characters={characters}
      ready={state.status === "ready"}
      equipment={equipment}
      progression={progression}
    />
  );
}
function ArchiveScreen({
  view,
  characters,
  ready,
  equipment,
  progression,
}: {
  view: CharacterArchiveView;
  characters: ReturnType<typeof presentCharacterArchive>;
  ready: boolean;
  equipment: ReturnType<typeof useEquipmentSession>;
  progression: ReturnType<typeof d5ProgressionView> | null;
}) {
  const [equipmentOpen,setEquipmentOpen] = useState(false);
  const [search, setSearch] = useState(() => window.location.search);
  const location = parseCharacterLocation(search);
  const requested = parseLocator(search), requestedRun = requested?.expeditionId;
  const [limit, setLimit] = useState(30);
  useEffect(() => {
    const update = () => {
      setSearch(window.location.search);
      setLimit(30);
    };
    window.addEventListener("popstate", update);
    window.addEventListener("pageshow", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);
  const selected =
    characters.find((c) => c.profile.id === location.characterId) ??
    characters.find((c) => c.profile.id === view.leaderId) ??
    characters[0];
  const locator = {
    saveId: view.head.saveId,
    epoch: view.head.epoch,
    ...(view.runRef?.kind === "memory" ? {memory: {id: view.runRef.id, attempt: view.runRef.attempt}} : view.runId ? { expeditionId: view.runId } : {}),
  };
  const change = (patch: Partial<CharacterLocation>) => {
    const next = { ...location, ...patch };
    setEquipmentOpen(false);
    setLimit(30);
    window.history.replaceState(
      null,
      "",
      gameHref("character-status", locator, next),
    );
    setSearch(window.location.search);
  };
  if (requestedRun && (view.runRef?.kind === "memory" || requestedRun !== view.runId) || requested?.memory && (view.runRef?.kind !== "memory" || requested.memory.id !== view.runRef.id || requested.memory.attempt !== view.runRef.attempt))
    return (
      <div className="game-client-gate" role="alert">
        <p>这趟远征已结束或发生变化，请返回当前档案。</p>
        <a href={gameHref("menu", locator)}>返回菜单</a>
        <a href={gameHref("map", locator)}>返回地图</a>
      </div>
    );
  const returnPage =
    location.from === "battle" && !view.runRef ? "map" : location.from;
  const returnLabel = `返回${returnPage === "battle" ? "战斗" : returnPage === "map" ? "地图" : "菜单"}`;
  return (
    <Stage background="var(--abyssa-character-status-backdrop)">
      <AbyssaProvider className="character-status-app">
        <aside className="character-status-app__menu" aria-label="角色页导航">
          <GameMenu
            title="角色菜单"
            busy={!ready || equipment.state.status === "submitting"}
            commands={returnPage === "menu" ? [] : [{id:"retreat", label:returnLabel, href:gameHref(returnPage, locator)}]}
            navigation={[
              {id:"menu", label:"返回菜单", href:gameHref("menu", locator)},
              {id:"mansion", label:"洋馆", href:gameHref("mansion", locator)},
              {id:"journey", label:view.runRef?.kind === "memory" ? "继续回忆" : view.runRef ? "继续远征" : "出征编队", href:gameHref(view.runRef ? "battle" : "map", locator)},
              {id:"archive", label:"档案", href:gameHref("title")},
            ]}
          />
        </aside>
        <div
          className="character-status-app__navigation"
          aria-label="档案状态"
        >
          {view.runRef?.kind === "memory" && <span>回忆中的固定配置 · 不代表当下羁绊</span>}
          {!ready && <span>等待档案读取</span>}
          <span>
            {view.simulation
              ? "测试档案"
              : view.version === 1
                ? "旧版档案"
                : "角色档案"}{" "}
            · {progression?.canMove ? "馆内整备" : "只读"}
          </span>
          {location.characterId &&
            location.characterId !== selected.profile.id && (
              <span role="status">所选角色不存在，已显示当前队伍。</span>
            )}
        </div>
        <main className="character-status-app__main">
          <CharacterStatusScreen
            characters={characters.map((c) => c.profile)}
            selectedId={selected.profile.id}
            activeMenuId={location.tab}
            menuItems={tabs}
            onSelectedIdChange={(characterId) => change({ characterId })}
            onActiveMenuIdChange={(tab) =>
              change({ tab: tab as CharacterLocation["tab"] })
            }
            renderTabPanel={({ menuId }) => {
              if (menuId === "dice")
                return (
                  <DiceLoadoutPanel
                    loadout={selected.dice}
                    characterName={
                      selected.profile.selectorLabel ?? selected.profile.name
                    }
                    themeColor="var(--abyssa-teal)"
                    equipmentAction={progression && (progression.applicableOwners.includes(selected.profile.id) ? <DiceActionButton label={progression.canMove ? "管理通用装备" : "出征期间配置已冻结"} disabled={!ready || !progression.canMove || !equipment.writer} onClick={()=>setEquipmentOpen(true)}/> : <span>无原生空面，不适用通用装备。</span>)}
                  />
                );
              if (menuId === "archive")
                return (
                  <div className="character-status-app__chronicle">
                    <CharacterChroniclePanel
                      key={selected.profile.id}
                      leadingContent={selected.profile.id === "marietta" ? <CharacterMemoryEntry writer={equipment.writer}/> : undefined}
                      chronicle={{
                        ...selected.chronicle,
                        blocks: selected.chronicle.blocks.slice(-limit),
                      }}
                      characterName={
                        selected.profile.selectorLabel ?? selected.profile.name
                      }
                      summary={[{ label: "来源", value: "实际冒险" }]}
                    />
                    {selected.chronicle.blocks.length > limit && (
                      <button onClick={() => setLimit((n) => n + 30)}>
                        显示更早记事
                      </button>
                    )}
                  </div>
                );
              return (
                <StatusPanel
                  data={{
                    ...selected.profile.status,
                    notice: `${location.characterId && location.characterId !== selected.profile.id ? "所选角色不存在，已显示当前队伍。 " : ""}${selected.notes}`,
                  }}
                />
              );
            }}
          />
        </main>
        {progression && <EquipmentEditor key={selected.profile.id} open={equipmentOpen} onClose={()=>setEquipmentOpen(false)} ownerId={selected.profile.id} progression={progression} writer={equipment.writer} state={equipment.state}/>}
      </AbyssaProvider>
    </Stage>
  );
}
