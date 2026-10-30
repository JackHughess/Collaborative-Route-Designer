import { memo } from "react";
import { PLAYER_RADIUS } from "@/lib/field/constants";
import { svgY } from "@/lib/field/geometry";
import type { Player, Point } from "@/lib/play/types";

interface Props {
  player: Player;
  /** Where to draw the player; differs from player.x/y during playback. */
  at: Point;
  selected: boolean;
  /** Outline colours of other people who have this player selected. */
  remoteColors?: readonly string[];
}

export const PlayerToken = memo(function PlayerToken({
  player,
  at,
  selected,
  remoteColors = [],
}: Props) {
  const cx = at.x;
  const cy = svgY(at.y);
  return (
    <g>
      {remoteColors.map((color, i) => (
        <circle
          key={color + i}
          cx={cx}
          cy={cy}
          r={PLAYER_RADIUS + 0.3 + i * 0.25}
          fill="none"
          stroke={color}
          strokeWidth={0.18}
          strokeDasharray="0.5 0.25"
          pointerEvents="none"
        />
      ))}
      {selected && (
        <circle
          cx={cx}
          cy={cy}
          r={PLAYER_RADIUS + 0.28}
          fill="none"
          stroke="white"
          strokeWidth={0.2}
          pointerEvents="none"
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={PLAYER_RADIUS}
        fill={player.color}
        stroke="white"
        strokeWidth={0.12}
      />
      <text
        x={cx}
        y={cy}
        fill="white"
        fontSize={player.label.length > 2 ? 0.62 : 0.8}
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="central"
        pointerEvents="none"
        className="select-none"
      >
        {player.label}
      </text>
    </g>
  );
});
