import { memo } from "react";
import {
  endAngle,
  routeSegments,
  segmentsToPath,
  svgY,
} from "@/lib/field/geometry";
import type { Player, Route } from "@/lib/play/types";

interface Props {
  route: Route;
  player: Player;
  selected: boolean;
  /** Fade routes while playback is running or for non-selected options. */
  muted?: boolean;
}

/** A route's path with its end cap. Pure: the same route and player draw the same shape. */
export const RouteShape = memo(function RouteShape({
  route,
  player,
  selected,
  muted,
}: Props) {
  const segments = routeSegments(player, route.points);
  if (segments.length === 0) return null;
  const d = segmentsToPath(segments);
  const end = route.points[route.points.length - 1];
  const angle = endAngle(segments);
  // SVG rotation is clockwise with y pointing down, so negate the field angle.
  const deg = angle === undefined ? 0 : (-angle * 180) / Math.PI;
  const strokeWidth = selected ? 0.32 : 0.24;

  return (
    <g opacity={muted ? 0.45 : 1} pointerEvents="none">
      {selected && (
        <path
          d={d}
          fill="none"
          stroke="white"
          strokeOpacity={0.5}
          strokeWidth={strokeWidth + 0.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={player.color}
        strokeWidth={strokeWidth}
        strokeDasharray={route.style === "dashed" ? "0.7 0.45" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g transform={`translate(${end.x} ${svgY(end.y)}) rotate(${deg})`}>
        {route.endCap === "arrow" ? (
          <path d="M 0 0 L -0.9 -0.5 L -0.9 0.5 Z" fill={player.color} />
        ) : (
          <line
            x1={0}
            x2={0}
            y1={-0.7}
            y2={0.7}
            stroke={player.color}
            strokeWidth={0.3}
            strokeLinecap="round"
          />
        )}
      </g>
    </g>
  );
});
