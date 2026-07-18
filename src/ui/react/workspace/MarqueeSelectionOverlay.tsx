import type { ViewportRect } from "./tableMarqueeSelection";

export function MarqueeSelectionOverlay({
  rect,
}: Readonly<{ rect: ViewportRect }>) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[70] size-full overflow-visible"
      data-marquee-selection
      aria-hidden="true"
    >
      <rect
        x={rect.left}
        y={rect.top}
        width={rect.width}
        height={rect.height}
        className="fill-blue-500/15 stroke-blue-500"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
