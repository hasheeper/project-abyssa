import { useId } from "react";

type FrameEdge = "top" | "right" | "bottom" | "left";

export interface FrameEdgeWeaveProps {
  namespace: string;
}

function FrameEdge({ edge, namespace }: { edge: FrameEdge; namespace: string }) {
  const patternId = `abyssa-frame-edge-${useId().replaceAll(":", "")}`;
  const vertical = edge === "left" || edge === "right";

  return (
    <svg
      className={`${namespace}__edge`}
      data-frame-edge={edge}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={patternId}
          width={vertical ? 18 : 96}
          height={vertical ? 96 : 18}
          patternUnits="userSpaceOnUse"
        >
          <g transform={vertical ? "translate(18 0) rotate(90)" : undefined}>
            <path className={`${namespace}__edge-rail-shadow`} d="M0 9H96" />
            <path className={`${namespace}__edge-rail`} d="M0 9H96" />

            <path
              className={`${namespace}__edge-strand-shadow`}
              d="M0 9C6 4.8 18 4.8 24 9S42 13.2 48 9 66 4.8 72 9 90 13.2 96 9"
            />
            <path
              className={`${namespace}__edge-strand-shadow`}
              d="M0 9C6 13.2 18 13.2 24 9S42 4.8 48 9 66 13.2 72 9 90 4.8 96 9"
            />
            <path
              className={`${namespace}__edge-strand`}
              d="M0 9C6 4.8 18 4.8 24 9S42 13.2 48 9 66 4.8 72 9 90 13.2 96 9"
            />
            <path
              className={`${namespace}__edge-strand`}
              d="M0 9C6 13.2 18 13.2 24 9S42 4.8 48 9 66 13.2 72 9 90 4.8 96 9"
            />
            <path
              className={`${namespace}__edge-highlight`}
              d="M0 8.55C6 4.35 18 4.35 24 8.55S42 12.75 48 8.55 66 4.35 72 8.55 90 12.75 96 8.55"
            />
            <path
              className={`${namespace}__edge-highlight`}
              d="M0 8.55C6 12.75 18 12.75 24 8.55S42 4.35 48 8.55 66 12.75 72 8.55 90 4.35 96 8.55"
            />
            <path className={`${namespace}__edge-overpass-shadow`} d="M20 6.8c2 .7 3 1.4 4 2.2s2 2.2 4 2.9M68 6.8c2 .7 3 1.4 4 2.2s2 2.2 4 2.9" />
            <path className={`${namespace}__edge-overpass`} d="M20 6.8c2 .7 3 1.4 4 2.2s2 2.2 4 2.9M68 6.8c2 .7 3 1.4 4 2.2s2 2.2 4 2.9" />
            <path className={`${namespace}__edge-overpass-highlight`} d="M20.3 6.45c2 .7 3 1.4 4 2.2s2 2.2 4 2.9M68.3 6.45c2 .7 3 1.4 4 2.2s2 2.2 4 2.9" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

export function FrameEdgeWeave({ namespace }: FrameEdgeWeaveProps) {
  return (
    <span className={`${namespace}__edge-weave`} aria-hidden="true">
      <FrameEdge edge="top" namespace={namespace} />
      <FrameEdge edge="right" namespace={namespace} />
      <FrameEdge edge="bottom" namespace={namespace} />
      <FrameEdge edge="left" namespace={namespace} />
    </span>
  );
}
