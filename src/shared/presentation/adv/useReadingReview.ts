import { useState } from "react";

export type ReadingChapter<T> = {id: string; title: string; pages: readonly T[]};
/** Presentation-only position, separate from every durable game cursor. */
export function useReadingReview<T>(chapters: readonly ReadingChapter<T>[]) {
  const live = chapters.at(-1)!;
  const [selection, setSelection] = useState<{owner: string; id: string; cursor: number} | null>(null);
  const selected = selection?.owner === live.id ? chapters.findIndex(c => c.id === selection.id) : -1;
  const reviewing = selected >= 0, index = reviewing ? selected : chapters.length - 1;
  const chapter = chapters[index], cursor = reviewing ? Math.min(selection!.cursor, chapter.pages.length - 1) : chapter.pages.length - 1;
  const exit = () => setSelection(null);
  const go = (index: number) => {
    const target = chapters[index]; if (!target?.pages.length) return;
    if (index === chapters.length - 1) exit();
    else setSelection({owner: live.id, id: target.id, cursor: target.pages.length - 1});
  };
  return {reviewing, index, total: chapters.length, cursor, page: reviewing ? chapter.pages[cursor] : undefined,
    atEnd: cursor >= chapter.pages.length - 1, canReplay: chapter.pages.length > 0,
    exit, go, replay: () => setSelection({owner: live.id, id: chapter.id, cursor: 0}),
    next: () => {if (cursor < chapter.pages.length - 1) setSelection({owner: live.id, id: chapter.id, cursor: cursor + 1});else exit();}};
}
