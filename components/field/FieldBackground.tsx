import { memo } from "react";
import {
  FIELD_WIDTH,
  HASH_LEFT,
  HASH_RIGHT,
  MAX_Y,
  MIN_Y,
} from "@/lib/field/constants";
import { svgY } from "@/lib/field/geometry";

const HASH_LENGTH = 0.66;
const SIDELINE_TICK = 0.66;

/** Static field: grass, yard lines, hash marks and the line of scrimmage. */
export const FieldBackground = memo(function FieldBackground() {
  const yards: number[] = [];
  for (let y = Math.ceil(MIN_Y); y <= MAX_Y; y++) yards.push(y);

  return (
    <g aria-hidden="true" pointerEvents="none">
      <rect
        x={-3}
        y={svgY(MAX_Y)}
        width={FIELD_WIDTH + 6}
        height={MAX_Y - MIN_Y}
        className="fill-emerald-800 dark:fill-emerald-950"
      />
      <rect
        x={0}
        y={svgY(MAX_Y)}
        width={FIELD_WIDTH}
        height={MAX_Y - MIN_Y}
        className="fill-emerald-700 dark:fill-emerald-900"
      />
      {yards.map((y) => {
        const sy = svgY(y);
        if (y % 5 === 0) {
          return (
            <line
              key={y}
              x1={0}
              x2={FIELD_WIDTH}
              y1={sy}
              y2={sy}
              stroke="white"
              strokeOpacity={y === 0 ? 0 : 0.55}
              strokeWidth={y % 10 === 0 ? 0.16 : 0.1}
            />
          );
        }
        return (
          <g key={y} stroke="white" strokeOpacity={0.5} strokeWidth={0.08}>
            <line x1={0} x2={SIDELINE_TICK} y1={sy} y2={sy} />
            <line
              x1={HASH_LEFT - HASH_LENGTH / 2}
              x2={HASH_LEFT + HASH_LENGTH / 2}
              y1={sy}
              y2={sy}
            />
            <line
              x1={HASH_RIGHT - HASH_LENGTH / 2}
              x2={HASH_RIGHT + HASH_LENGTH / 2}
              y1={sy}
              y2={sy}
            />
            <line
              x1={FIELD_WIDTH - SIDELINE_TICK}
              x2={FIELD_WIDTH}
              y1={sy}
              y2={sy}
            />
          </g>
        );
      })}
      {yards
        .filter((y) => y % 10 === 0 && y !== 0)
        .map((y) => (
          <g
            key={`n${y}`}
            fill="white"
            fillOpacity={0.6}
            fontSize={1.8}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="central"
          >
            <text x={9} y={svgY(y)}>
              {y > 0 ? `+${y}` : y}
            </text>
            <text x={FIELD_WIDTH - 9} y={svgY(y)}>
              {y > 0 ? `+${y}` : y}
            </text>
          </g>
        ))}
      <line
        x1={0}
        x2={FIELD_WIDTH}
        y1={0}
        y2={0}
        stroke="#60a5fa"
        strokeWidth={0.22}
      />
      <rect
        x={0}
        y={svgY(MAX_Y)}
        width={FIELD_WIDTH}
        height={MAX_Y - MIN_Y}
        fill="none"
        stroke="white"
        strokeWidth={0.3}
      />
    </g>
  );
});
