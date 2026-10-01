import { cubicBezier } from "motion/react";
import { motionTokens } from "../../shared/ui/motion/presets";

type Box = { x: number; y: number; width: number; height: number };
type Row = { box: Box; parts: Map<string, Box>; copy: HTMLElement | null; copyAlpha: number };
type ReaderItem = { alpha: number; blur: number };
export type MemoryLayoutSnapshot = { width: number; rows: Map<string, Row>; readerItems: Map<string, ReaderItem> };
const [x1, y1, x2, y2] = motionTokens.memoryJournal.layoutEase;
const layoutEase = cubicBezier(x1, y1, x2, y2);
const [rx1, ry1, rx2, ry2] = motionTokens.memoryJournal.revealEase;
const revealEase = cubicBezier(rx1, ry1, rx2, ry2);
const softRamp = (elapsed: number, start: number, duration: number) => revealEase(Math.max(0, Math.min(1, (elapsed - start) / duration)));
const parts = [".memory-entry__node", ".memory-entry__art", ".memory-entry__copy", ".memory-entry__when"];
const box = (element: HTMLElement, scale: number): Box => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale };
};
const scaleOf = (root: HTMLElement) => root.getBoundingClientRect().width / root.offsetWidth || 1;

/** Preserve the old line breaks while the live copy takes its final layout.
 * This temporary, non-interactive layer fades in place; it never reflows. */
function freezeCopy(source: HTMLElement) {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll<HTMLElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  const properties = ["display", "font", "letter-spacing", "color", "line-height", "white-space", "overflow", "text-overflow", "-webkit-line-clamp", "-webkit-box-orient", "padding", "margin"];
  originals.forEach((element, index) => {
    const style = getComputedStyle(element), copy = copies[index];
    for (const property of properties) copy.style.setProperty(property, style.getPropertyValue(property));
    copy.style.width = style.width;
    copy.style.height = style.height;
    copy.style.transition = "none";
    copy.style.translate = "none";
    copy.style.opacity = "1";
  });
  clone.classList.add("memory-entry__copy--outgoing");
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "absolute";
  clone.style.pointerEvents = "none";
  return clone;
}

/** Read the live painted positions, including an interrupted transition. */
export function captureMemoryLayout(root: HTMLElement, preserveCopy = true): MemoryLayoutSnapshot {
  const scale = scaleOf(root), list = root.querySelector<HTMLElement>(".memory-catalogue");
  const rows = new Map<string, Row>();
  root.querySelectorAll<HTMLElement>("[data-memory-id]").forEach(row => {
    const copy = Array.from(row.querySelectorAll<HTMLElement>(".memory-entry__copy"))
      .sort((a, b) => Number(getComputedStyle(b).opacity) - Number(getComputedStyle(a).opacity))[0];
    rows.set(row.dataset.memoryId!, { box: box(row, scale), copy: copy && preserveCopy ? freezeCopy(copy) : null, copyAlpha: copy ? Number(getComputedStyle(copy).opacity) : 0, parts: new Map(parts.flatMap(selector => {
      const element = selector === ".memory-entry__copy" ? copy : row.querySelector<HTMLElement>(selector);
      return element ? [[selector, box(element, scale)] as const] : [];
    })) });
  });
  const reader = root.querySelector<HTMLElement>(".memory-reader"), text = reader?.querySelector<HTMLElement>(".memory-reader__text");
  const textStyle = text ? getComputedStyle(text) : null;
  const parentAlpha = !reader || reader.hidden || !textStyle ? 0 : Number(textStyle.opacity);
  const blurOf = (filter: string) => Number.parseFloat(filter.replace("blur(", "")) || 0;
  const readerItems = new Map<string, ReaderItem>();
  reader?.querySelectorAll<HTMLElement>("[data-memory-reader-item]").forEach(element => {
    const style = getComputedStyle(element);
    readerItems.set(element.dataset.memoryReaderItem!, { alpha: Number(style.opacity) * parentAlpha, blur: blurOf(style.filter) + blurOf(textStyle?.filter ?? "") });
  });
  return { width: list ? box(list, scale).width : 0, rows, readerItems };
}

/** Dates and artwork move with their rows. Each text layout keeps a fixed
 * font, width and line clamp; the two layouts exchange opacity. */
export function bindMemoryLayout(root: HTMLElement, before: MemoryLayoutSnapshot, opening: boolean) {
  const list = root.querySelector<HTMLElement>(".memory-catalogue");
  const track = root.querySelector<HTMLElement>(".memory-catalogue__track");
  if (!list || !track) return { paint: (_: number) => {}, clear: () => {} };
  const after = captureMemoryLayout(root, false), changed = new Set<HTMLElement>();
  const move = (element: HTMLElement, x: number, y: number, remaining: number) => {
    changed.add(element); element.style.translate = `${x * remaining}px ${y * remaining}px`;
  };
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-id]"), element => {
    const id = element.dataset.memoryId!;
    const old = before.rows.get(id), next = after.rows.get(id);
    const copyBox = next?.parts.get(".memory-entry__copy");
    if (old?.copy && next && copyBox) {
      old.copy.style.left = `${copyBox.x - next.box.x}px`;
      old.copy.style.top = `${copyBox.y - next.box.y}px`;
      element.querySelector(".memory-entry")?.append(old.copy);
    }
    return { element, button: element.querySelector<HTMLElement>(".memory-entry"), old, next, parts: parts.map(selector => ({ selector, element: element.querySelector<HTMLElement>(selector) })) };
  });
  const readerText = root.querySelector<HTMLElement>(".memory-reader__text");
  const readerBounds = root.querySelector(".memory-reader")?.getBoundingClientRect();
  const readerItems = Array.from(root.querySelectorAll<HTMLElement>("[data-memory-reader-item]"));
  // Stagger the components currently in view. Long records must not create a
  // queue of invisible paragraphs or replay when the reader scrolls later.
  const visibleReaderItems = readerItems.filter(element => {
    const rect = element.getBoundingClientRect();
    return readerBounds && rect.bottom > readerBounds.top && rect.top < readerBounds.bottom;
  });
  const readerStep = Math.min(motionTokens.memoryJournal.opening.readerStaggerMs,
    motionTokens.memoryJournal.opening.readerMaxStaggerMs / Math.max(1, visibleReaderItems.length - 1));
  // Freeze the target track geometry while its clipping viewport changes width.
  track.style.width = `${track.getBoundingClientRect().width / scaleOf(root)}px`;
  const duration = opening ? motionTokens.memoryJournal.openMs : motionTokens.memoryJournal.closeMs;
  const timing = opening ? motionTokens.memoryJournal.opening : motionTokens.memoryJournal.closing;
  const layoutStart = opening ? 0 : motionTokens.memoryJournal.closing.layoutStartMs;
  return {
    paint: (progress: number) => {
      const elapsed = progress * duration;
      const remaining = 1 - layoutEase(Math.max(0, Math.min(1, (elapsed - layoutStart) / timing.layoutMs)));
      const textAlpha = softRamp(elapsed, timing.textStartMs, timing.textMs);
      list.style.width = `${after.width + (before.width - after.width) * remaining}px`;
      root.style.setProperty("--memory-meta-alpha", String(softRamp(elapsed, layoutStart + timing.layoutMs, duration - layoutStart - timing.layoutMs)));
      for (const row of rows) {
        if (!row.old || !row.next) continue;
        const dy = row.old.box.y - row.next.box.y;
        move(row.element, 0, dy, remaining);
        row.element.style.height = `${row.next.box.height}px`;
        if (row.button) {
          row.button.style.minHeight = "0";
          row.button.style.height = `${row.next.box.height + (row.old.box.height - row.next.box.height) * remaining}px`;
        }
        // The row's separator and selected wash follow the moving page edge.
        row.element.style.setProperty("--memory-row-extension", `${(row.old.box.width - row.next.box.width) * remaining}px`);
        for (const part of row.parts) {
          const old = row.old.parts.get(part.selector), next = row.next.parts.get(part.selector);
          if (!part.element || !old || !next || !next.width || !next.height) continue;
          // Text fades at its settled position, independent of the moving row.
          move(part.element, part.selector === ".memory-entry__copy" ? 0 : old.x - next.x,
            part.selector === ".memory-entry__copy" ? -dy : old.y - next.y - dy, remaining);
          if (part.selector === ".memory-entry__art") {
            part.element.style.transformOrigin = "top left";
            part.element.style.scale = String(1 + (old.width / next.width - 1) * remaining);
          }
          if (part.selector === ".memory-entry__copy") {
            part.element.style.opacity = String(textAlpha);
            if (row.old.copy) {
              move(row.old.copy, old.x - next.x, old.y - next.y - dy * remaining, 1);
              row.old.copy.style.opacity = String(row.old.copyAlpha * (1 - softRamp(elapsed, 0, timing.textOutMs)));
            }
          }
        }
      }
      if (readerText) {
        changed.add(readerText);
        readerText.style.setProperty("--memory-local-alpha", "1");
        for (const element of readerItems) {
          const old = before.readerItems.get(element.dataset.memoryReaderItem!) ?? { alpha: 0, blur: 0 };
          const order = visibleReaderItems.indexOf(element);
          const reveal = opening ? order < 0 ? 1 : softRamp(elapsed,
            motionTokens.memoryJournal.opening.readerStartMs + order * readerStep, motionTokens.memoryJournal.opening.readerMs)
            : softRamp(elapsed, 0, motionTokens.memoryJournal.closing.readerMs);
          const alpha = old.alpha + ((opening ? 1 : 0) - old.alpha) * reveal;
          changed.add(element);
          element.style.setProperty("--memory-reader-item-alpha", String(alpha));
          element.style.setProperty("--memory-reader-item-blur", `${opening ? 4 * (1 - alpha) : old.blur}px`);
          if (order >= 0) element.setAttribute("data-memory-reader-animating", "");
        }
      }
    },
    clear: () => {
      list.style.removeProperty("width"); track.style.removeProperty("width");
      root.style.removeProperty("--memory-meta-alpha");
      rows.forEach(({ element, button, old }) => {
        old?.copy?.remove(); element.style.removeProperty("--memory-row-extension"); element.style.removeProperty("height");
        button?.style.removeProperty("height"); button?.style.removeProperty("min-height");
      });
      changed.forEach(element => {
        element.removeAttribute("data-memory-reader-animating");
        for (const name of ["translate", "scale", "transform-origin", "opacity", "--memory-local-alpha", "--memory-reader-item-alpha", "--memory-reader-item-blur"]) element.style.removeProperty(name);
      });
    },
  };
}
