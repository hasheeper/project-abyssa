import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { IconButton } from "./IconButton";

export interface ArrowButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof IconButton>, "children"> {
  direction: "up" | "right" | "down" | "left";
  double?: boolean;
}

const rotations = { up: -90, right: 0, down: 90, left: 180 } as const;

export const ArrowButton = forwardRef<HTMLButtonElement, ArrowButtonProps>(
  function ArrowButton({ direction, double = false, ...props }, ref) {
    return (
      <IconButton ref={ref} {...props}>
        <svg
          className="abyssa-arrow-icon"
          viewBox="0 0 32 32"
          style={{ transform: `rotate(${rotations[direction]}deg)` }}
        >
          {double ? (
            <>
              <path d="M5 5 L16 16 L5 27" />
              <path d="M13 5 L24 16 L13 27" />
            </>
          ) : (
            <path d="M10.5 5 L21.5 16 L10.5 27" />
          )}
        </svg>
      </IconButton>
    );
  }
);
