import type { PartyFigureId } from "../../content/characters/partyFigureCalibration";
import type { PartyFigureCatalogEntry } from "../../assets/map/party-figures/catalog";

export interface PartyFigureRosterProps {
  catalog: readonly PartyFigureCatalogEntry[];
  activeId: PartyFigureId;
  partyIds: readonly PartyFigureId[];
  dirtyIds: ReadonlySet<PartyFigureId>;
  onSelect: (id: PartyFigureId) => void;
  onToggleParty: (id: PartyFigureId) => void;
}

export function PartyFigureRoster({
  catalog,
  activeId,
  partyIds,
  dirtyIds,
  onSelect,
  onToggleParty
}: PartyFigureRosterProps) {
  const partyFull = partyIds.length >= 5;

  return (
    <aside className="party-figure-roster" aria-label="十人立绘名册">
      <header>
        <p>FIGURE CATALOG</p>
        <h2>十人立绘</h2>
        <span>{partyIds.length} / 5 已加入编队对比</span>
      </header>
      <ol>
        {catalog.map((entry, index) => {
          const active = entry.id === activeId;
          const enlisted = partyIds.includes(entry.id);
          return (
            <li key={entry.id} data-active={active || undefined}>
              <button
                className="party-figure-roster__select"
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(entry.id)}
              >
                <span className="party-figure-roster__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="party-figure-roster__thumb">
                  <img src={entry.url} alt="" draggable={false} />
                </span>
                <span className="party-figure-roster__name">
                  <b>{entry.name}</b>
                  <small>{entry.id}</small>
                </span>
                {dirtyIds.has(entry.id) && <i title="参数已修改">●</i>}
              </button>
              <label className="party-figure-roster__party-toggle">
                <input
                  type="checkbox"
                  checked={enlisted}
                  disabled={!enlisted && partyFull}
                  onChange={() => onToggleParty(entry.id)}
                />
                <span>{enlisted ? "移出" : "叠排"}</span>
              </label>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
