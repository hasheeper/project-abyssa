import { useEffect, useMemo, useRef } from "react";
import type {
  HTMLAttributes,
  KeyboardEventHandler
} from "react";
import { useControllableState } from "../hooks/useControllableState";
import { cx } from "../utils/cx";
import { ArrowButton } from "./ArrowButton";
import { RibbonFrameArt } from "./RibbonButton";
import { RpgShapeButton } from "./RpgShapeButton";
import type { StatusPanelAffiliationTone } from "./StatusPanel";

export interface CharacterPortraitSelectorItem {
  id: string;
  label: string;
  number: string;
  thumbnailUrl?: string;
  thumbnailAlt?: string;
  tone?: StatusPanelAffiliationTone;
  disabled?: boolean;
}

export interface CharacterPortraitSelectorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: CharacterPortraitSelectorItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  loop?: boolean;
  label?: string;
}

export function CharacterPortraitSelector({
  items,
  value,
  defaultValue,
  onValueChange,
  loop = true,
  label = "角色选择",
  className,
  onKeyDown,
  ...props
}: CharacterPortraitSelectorProps) {
  const enabledItems = useMemo(
    () => items.filter((item) => !item.disabled),
    [items]
  );
  const initialValue = enabledItems.some((item) => item.id === defaultValue)
    ? defaultValue!
    : enabledItems[0]?.id ?? "";
  const [selectedId, setSelectedId] = useControllableState({
    value,
    defaultValue: initialValue,
    onChange: onValueChange
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const selectedItemRef = useRef<HTMLButtonElement | null>(null);
  const resolvedSelectedId = enabledItems.some((item) => item.id === selectedId)
    ? selectedId
    : enabledItems[0]?.id ?? "";

  const findAdjacentId = (offset: -1 | 1) => {
    if (enabledItems.length === 0) return undefined;

    const currentIndex = enabledItems.findIndex(
      (item) => item.id === resolvedSelectedId
    );
    if (currentIndex < 0) {
      return offset > 0
        ? enabledItems[0]?.id
        : enabledItems[enabledItems.length - 1]?.id;
    }

    const adjacentIndex = currentIndex + offset;
    if (loop) {
      const wrappedIndex =
        (adjacentIndex + enabledItems.length) % enabledItems.length;
      return enabledItems[wrappedIndex]?.id;
    }

    return enabledItems[adjacentIndex]?.id;
  };

  const previousId = findAdjacentId(-1);
  const nextId = findAdjacentId(1);
  const canSelectPrevious =
    previousId !== undefined && previousId !== resolvedSelectedId;
  const canSelectNext = nextId !== undefined && nextId !== resolvedSelectedId;

  const selectId = (id: string | undefined) => {
    if (id === undefined || id === selectedId) return;
    setSelectedId(id);
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    const selectedItem = selectedItemRef.current;
    if (!viewport || !selectedItem) return;

    const viewportRect = viewport.getBoundingClientRect();
    const selectedItemRect = selectedItem.getBoundingClientRect();
    const selectedItemCenter =
      selectedItemRect.left -
      viewportRect.left +
      viewport.scrollLeft +
      selectedItemRect.width / 2;
    const requestedLeft = selectedItemCenter - viewport.clientWidth / 2;
    const left = Math.max(
      0,
      Math.min(requestedLeft, viewport.scrollWidth - viewport.clientWidth)
    );

    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({ left, behavior: "smooth" });
    } else {
      viewport.scrollLeft = left;
    }
  }, [resolvedSelectedId]);

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    let targetId: string | undefined;
    switch (event.key) {
      case "ArrowLeft":
        targetId = previousId;
        break;
      case "ArrowRight":
        targetId = nextId;
        break;
      case "Home":
        targetId = enabledItems[0]?.id;
        break;
      case "End":
        targetId = enabledItems[enabledItems.length - 1]?.id;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectId(targetId);
  };

  return (
    <div
      className={cx("abyssa-character-portrait-selector", className)}
      role="group"
      aria-label={label}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <ArrowButton
        className="abyssa-character-portrait-selector__arrow abyssa-character-portrait-selector__arrow--previous"
        direction="left"
        label="上一个角色"
        size="sm"
        shape="diamond"
        watermark={false}
        disabled={!canSelectPrevious}
        onClick={() => selectId(previousId)}
      />

      <div className="abyssa-character-portrait-selector__ribbon">
        <RibbonFrameArt
          className="abyssa-character-portrait-selector__ribbon-art"
          watermark={false}
          sideDiamonds={false}
          preserveAspectRatio="none"
        />
        <div className="abyssa-character-portrait-selector__well">
          <div
            ref={viewportRef}
            className="abyssa-character-portrait-selector__viewport"
          >
            <div className="abyssa-character-portrait-selector__track">
              {items.map((item) => {
                const selected = item.id === resolvedSelectedId;
                return (
                  <RpgShapeButton
                    key={item.id}
                    ref={selected ? selectedItemRef : undefined}
                    className="abyssa-character-portrait-selector__item"
                    label={item.label}
                    shape="square"
                    variant={selected ? "teal" : "dark"}
                    selected={selected}
                    disabled={item.disabled}
                    watermark={false}
                    data-character-id={item.id}
                    data-tone={item.tone}
                    aria-current={selected ? "true" : undefined}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectId(item.id)}
                  >
                    <span className="abyssa-character-portrait-selector__portrait">
                      {item.thumbnailUrl && (
                        <img
                          className="abyssa-character-portrait-selector__image"
                          src={item.thumbnailUrl}
                          alt={item.thumbnailAlt ?? ""}
                        />
                      )}
                      <span
                        className="abyssa-character-portrait-selector__number"
                        aria-hidden="true"
                      >
                        {item.number}
                      </span>
                    </span>
                  </RpgShapeButton>
                );
              })}
            </div>
          </div>
        </div>
        <RibbonFrameArt
          className="abyssa-character-portrait-selector__ribbon-outline"
          watermark={false}
          sideDiamonds={false}
          frameOnly
          preserveAspectRatio="none"
        />
      </div>

      <ArrowButton
        className="abyssa-character-portrait-selector__arrow abyssa-character-portrait-selector__arrow--next"
        direction="right"
        label="下一个角色"
        size="sm"
        shape="diamond"
        watermark={false}
        disabled={!canSelectNext}
        onClick={() => selectId(nextId)}
      />
    </div>
  );
}
