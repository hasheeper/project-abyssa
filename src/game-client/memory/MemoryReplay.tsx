import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ReadingPlayer } from "../../shared/presentation/adv/ReadingPlayer";
import { ReadingTool } from "../../shared/presentation/adv/ReadingTool";
import { SceneSequence } from "../../shared/presentation/adv/SceneSequence";
import { motionTokens, uiTransition } from "../../shared/ui/motion/presets";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import type { MemoryEntry } from "./memory-types";
import { memoryReplayPages } from "./memory-replay";
import "../first-morning.css";
import "./memory-replay.css";

/** Independent presentation cursor. No session, runtime, storage or navigation. */
export function MemoryReplay({ entry, actId, leaving, onClose, onExited }: {
  entry: MemoryEntry; actId?: string; leaving: boolean; onClose: () => void; onExited: () => void;
}) {
  const { reduced } = useUiMotion();
  const [playing, setPlaying] = useState({ actId, cursor: 0 });
  const acts = entry.narrative?.acts ?? [];
  const act = acts.find(a => a.id === playing.actId) ?? acts.find(a => a.replay === "scene");
  const actIndex = acts.findIndex(a => a.id === act?.id);
  const nextAct = acts[actIndex + 1]?.replay === "scene" ? acts[actIndex + 1] : null;
  const pages = useMemo(() => memoryReplayPages(entry, act?.id), [entry, act?.id]);
  const title = act ? `${entry.title} · ${act.title}` : entry.title;
  const cursor = playing.cursor;
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  const page = pages[cursor];
  if (!page) return null;
  const current = pages.slice(0, cursor + 1).filter(p => p.sceneId === page.sceneId);
  const chapters = new Map<string, { id: string; title: string; pages: typeof pages }>();
  for (const prior of pages.slice(0, cursor)) {
    if (prior.sceneId === page.sceneId) continue;
    if (!chapters.has(prior.sceneId)) chapters.set(prior.sceneId, { id: prior.sceneId, title: entry.title, pages: [] });
    chapters.get(prior.sceneId)!.pages.push(prior);
  }
  const last = cursor === pages.length - 1;
  const switchAct = (index: number) => { const next = acts[index]; if (!leaving && next?.replay === "scene") setPlaying({ actId: next.id, cursor: 0 }); };
  const advance = () => { if (last) { if (nextAct) switchAct(actIndex + 1); else onClose(); } else setPlaying(p => ({ ...p, cursor: Math.min(p.cursor + 1, pages.length - 1) })); };
  return <motion.section ref={root} className="memory-replay" role="region" aria-label={`场景回想：${entry.title}`} tabIndex={-1}
    data-leaving={leaving || undefined} initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: leaving ? 0 : 1 }}
    transition={uiTransition(reduced ? 0 : leaving ? motionTokens.memoryJournal.replayOutMs : motionTokens.memoryJournal.replayInMs)}
    onAnimationComplete={() => { if (leaving) onExited(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []).filter(el => !el.closest('[inert], [hidden]'));
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div className="memory-replay__surface" inert={leaving || undefined}>
      <SceneSequence advEntrance="dissolve" frame={{ id: act?.id ?? entry.id, kind: "adv", backdrop: page.background,
        assets: page.background ? [page.background] : [], content: <ReadingPlayer key={act?.id ?? entry.id} sceneId={page.sceneId} title={title}
          location={entry.location ?? "记忆"} className="first-morning" pages={current} history={[...chapters.values()]} busy={leaving} instant={reduced}
          canAdvance={!last} onNext={advance} finalLabel={nextAct ? "继续下一幕" : "回到手记"} onEscape={onClose}
          sceneNavigation={act ? { index: actIndex, total: acts.length, onScene: switchAct,
            previousDisabled: acts[actIndex - 1]?.replay !== "scene", nextDisabled: !nextAct } : undefined}
          actions={<ReadingTool label="结束回想" caption="BACK" glyph="back" onClick={onClose}/>}/>
      }}/>
    </div>
    <div className="memory-replay__caption" aria-hidden="true"><span>回想</span><span>{title}</span></div>
  </motion.section>;
}
