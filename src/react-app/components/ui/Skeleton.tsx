import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

// Shimmer skeleton placeholder — the Munshot loading standard for widgets.
// Size it to the final content shape via className/style; never use a bare
// spinner for a data load. The animated gradient lives in `.shimmer`
// (index.css).
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("shimmer", className)} style={style} aria-hidden="true" />
  );
}
