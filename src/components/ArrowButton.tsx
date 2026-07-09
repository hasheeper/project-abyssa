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
          <path d="M7 5 L18 16 L7 27" />
          {double && <path d="M14 5 L25 16 L14 27" />}
        </svg>
      </IconButton>
    );
  }
);
