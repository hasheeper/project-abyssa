import type { LootItemView } from "./loot-item";

/** Small stamped silhouettes remain legible at the corner of the item artwork. */
export function LootKindMark({ kind }: { kind: LootItemView["kind"] }) {
  return <svg className="loot-kind-mark" data-kind={kind} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    {kind === "preparation" ? <>
      <path className="loot-kind-mark__body" d="M9 1.5 15 4v5c0 3.5-3.7 6.1-6 7.5C6.7 15.1 3 12.5 3 9V4Z"/>
      <path className="loot-kind-mark__cut" d="M9 5v7M6.5 7.5h5"/>
    </> : kind === "common" ? <>
      <path className="loot-kind-mark__body" d="m5 2 4 1 4-1-1.5 4.5c2 2 4 4.1 3.5 6.5-.4 2.1-2.5 3-6 3s-5.6-.9-6-3c-.5-2.4 1.5-4.5 3.5-6.5Z"/>
      <path className="loot-kind-mark__cut" d="M6 7h6"/>
    </> : <>
      <path className="loot-kind-mark__body" d="m9 1 7 8-7 8-7-8Z"/>
      <path className="loot-kind-mark__cut" d="M7 6.7C7 4.5 11 4.5 11 6.7c0 1.6-2 1.6-2 3.3M9 12.5v.4"/>
    </>}
  </svg>;
}
