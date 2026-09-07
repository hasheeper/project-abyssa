/** Layer and turn readings sit in the instrument's recessed upper rail. */
export function CompanionStatus({layer, round, memory}: {layer: number; round: number; memory: boolean}) {
  return <header className="battle-companion__status">
    <div className="battle-companion__counters">
      <output className="battle-companion__counter" aria-label={memory ? "历史回忆" : `当前第 ${layer} 层`} title={memory ? "历史回忆" : `当前第 ${layer} 层`}>
        <svg viewBox="0 0 24 24" aria-hidden="true">{memory ? <path d="M3 4c4-1 6 0 9 2 3-2 5-3 9-2v16c-4-1-6 0-9 2-3-2-5-3-9-2Z M12 6v16"/> : <><path d="M4 20V4h16v16 M5 19h5v-5h5V9h4"/><path d="M10 20v-6 M15 20V9"/></>}</svg>
        <strong>{memory ? "忆" : layer}</strong>
      </output>
      <output className="battle-companion__counter" aria-label={`第 ${round} 回合`} title={`第 ${round} 回合`}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14 M5 21h14 M7 4v3c0 2 5 4 5 5s-5 3-5 5v3 M17 4v3c0 2-5 4-5 5s5 3 5 5v3"/><path className="battle-companion__sand" d="m9 7 3 3 3-3Z m3 7-4 4h8Z"/></svg>
        <strong>{round}</strong>
      </output>
    </div>
  </header>;
}
