import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { animate } from "motion/react";
import { loadImage } from "../../shared/loading/images";
import type { CharacterProfile } from "../../shared/ui/patterns/CharacterStatusScreen";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

type ChangePhase = "ready" | "preparing" | "leaving" | "entering";
const ease = [.2, .7, .2, 1] as const;

/** One character commit and clock for portrait/name and tabs/dossier. The outer
 * frame and character selector never animate or remount on a character change. */
export function useCharacterChange(requested: CharacterProfile | undefined, root: RefObject<HTMLElement | null>) {
  const { reduced } = useUiMotion();
  const [displayedId, setDisplayedId] = useState(requested?.id);
  const [phase, setPhase] = useState<ChangePhase>("ready");
  const latest = useRef(requested);
  const fresh = useRef(false);
  const portraits = useRef(new Map<string, string>());
  useLayoutEffect(() => { latest.current = requested; });

  useLayoutEffect(() => {
    const host = root.current;
    const left = host?.querySelector<HTMLElement>(".abyssa-character-screen__visual");
    const right = host?.querySelector<HTMLElement>(".abyssa-character-screen__details");
    if (!host || !left || !right) {
      setDisplayedId(requested?.id);
      setPhase("ready");
      return;
    }
    const groups = [left, right];
    let cancelled = false, frame = 0;
    const controls: ReturnType<typeof animate>[] = [];
    const stop = () => { cancelAnimationFrame(frame); controls.forEach(control => control.stop()); };
    const clear = () => groups.forEach(node => {
      node.style.removeProperty("opacity");
      node.style.removeProperty("translate");
      node.inert = false;
    });
    const settle = () => {
      stop(); fresh.current = false;
      clear();
      setDisplayedId(latest.current?.id);
      setPhase("ready");
    };
    const block = () => {
      if (groups.some(node => node.contains(document.activeElement))) {
        // Keep keyboard focus outside the outgoing/inert subtree. Do not send
        // it to body, and never move focus away from the live selector.
        [...host.querySelectorAll<HTMLButtonElement>("button[data-character-id]")]
          .find(node => node.dataset.characterId === latest.current?.id)?.focus({ preventScroll: true });
      }
      groups.forEach(node => { node.inert = true; });
    };

    if (reduced || document.hidden || !requested) {
      settle();
      return clear;
    }
    if (requested.id === displayedId) {
      const displaced = groups.some(node =>
        node.style.opacity && Number(node.style.opacity) < .999 ||
        node.style.translate && !["none", "0px", "0px 0px"].includes(node.style.translate));
      if (fresh.current || displaced) {
        block();
        setPhase("entering");
        if (fresh.current) {
          fresh.current = false;
          left.style.opacity = right.style.opacity = "0";
          left.style.translate = "-22px 0px";
          right.style.translate = "18px 0px";
        }
        // The new dossier has now committed. Starting before its heavy SVG
        // subtree mounts would consume the entry clock before the first paint.
        frame = requestAnimationFrame(() => {
          const incoming = groups.map((node, index) => animate(node,
            { opacity: 1, translate: "0px 0px" },
            { duration: .22, delay: index * .04, ease }));
          controls.push(...incoming);
          void Promise.all(incoming).then(() => { if (!cancelled) { clear(); setPhase("ready"); } });
        });
      } else {
        clear();
        setPhase("ready");
      }
    } else {
      block();
      setPhase("preparing");
      const previousUrl = host.querySelector<HTMLImageElement>(".abyssa-character-screen__portrait img")?.getAttribute("src");
      if (displayedId && previousUrl) portraits.current.set(displayedId, previousUrl);
      const available = [requested.portraitUrl, ...(requested.outfits?.map(outfit => outfit.portraitUrl) ?? [])];
      const remembered = portraits.current.get(requested.id);
      const imageUrl = remembered && available.includes(remembered) ? remembered : requested.outfits?.[0]?.portraitUrl ?? requested.portraitUrl;
      // If another choice interrupted entry/exit, recover the current dossier
      // while the newest portrait loads. Never hold an invisible old page.
      const recovering = groups.some(node => node.style.opacity && Number(node.style.opacity) < .999)
        ? groups.map(node => animate(node, { opacity: 1, translate: "0px 0px" }, { duration: .12, ease }))
        : [];
      controls.push(...recovering);
      const change = async () => {
        // Keep all old fields together while waiting; a failed load still
        // proceeds to the shared screen's normal missing-image placeholder.
        if (imageUrl) await loadImage(imageUrl).catch(() => undefined);
        if (cancelled) return;
        recovering.forEach(control => control.stop());
        setPhase("leaving");
        const outgoing = groups.map((node, index) => animate(node,
          { opacity: 0, translate: `${index ? 6 : -6}px 0px` },
          { duration: .08, ease: "easeIn" }));
        controls.push(...outgoing);
        await Promise.all(outgoing);
        if (cancelled) return;
        fresh.current = true;
        setDisplayedId(latest.current?.id);
      };
      void change();
    }
    const hidden = () => {
      if (!document.hidden) return;
      settle(); cancelled = true;
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", hidden);
      // Preserve the stopped visual values for an interrupted/latest request.
      // Inert is re-established in the next layout effect, before paint.
      groups.forEach(node => { node.inert = false; });
    };
  }, [requested?.id, displayedId, reduced, root]);

  return { displayedId, phase };
}
