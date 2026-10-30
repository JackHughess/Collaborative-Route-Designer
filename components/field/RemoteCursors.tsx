import { svgY } from "@/lib/field/geometry";
import type { Peer } from "@/lib/play/presence";

/** Other people's cursors, in yards, drawn on top of everything. */
export function RemoteCursors({ peers }: { peers: readonly Peer[] }) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      {peers.map((peer) =>
        peer.cursor ? (
          <g
            key={peer.clientId}
            transform={`translate(${peer.cursor.x} ${svgY(peer.cursor.y)})`}
          >
            <path
              d="M 0 0 L 0 1.6 L 0.45 1.2 L 0.8 1.9 L 1.05 1.78 L 0.72 1.1 L 1.25 1.1 Z"
              fill={peer.user.color}
              stroke="white"
              strokeWidth={0.08}
            />
            <g transform="translate(1.1 2.1)">
              <rect
                x={0}
                y={-0.45}
                width={Math.max(2, peer.user.name.length * 0.42 + 0.6)}
                height={0.9}
                rx={0.2}
                fill={peer.user.color}
              />
              <text
                x={0.3}
                y={0}
                fontSize={0.6}
                fill="white"
                dominantBaseline="central"
              >
                {peer.user.name}
              </text>
            </g>
          </g>
        ) : null,
      )}
    </g>
  );
}
