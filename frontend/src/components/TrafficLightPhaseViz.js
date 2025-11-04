import React from "react";
import { parsePhaseStateToDirections as __parsePhaseStateToDirections } from "../utils/tlsConfigParser";

/**
 * Traffic Light Phase Visualization Component
 * Displays traffic light phases with directional arrows for left, straight, and right turns
 */
const TrafficLightPhaseViz = ({
  phaseState,
  size = 300,
  showLabels = true,
  className = "",
  style = {},
  turns = null,
}) => {
  const safeParse = (state) => {
    if (typeof __parsePhaseStateToDirections === 'function') {
      return __parsePhaseStateToDirections(state);
    }
    // Fallback parser: all red if parser unavailable
    const fallback = {
      N: { L: "r", S: "r", R: "r" },
      E: { L: "r", S: "r", R: "r" },
      S: { L: "r", S: "r", R: "r" },
      W: { L: "r", S: "r", R: "r" },
    };
    if (!state || state.length < 4) return fallback;
    const chars = String(state).toLowerCase().split("");
    if (chars.length >= 12) {
      return {
        N: { L: chars[0]||'r', S: chars[1]||'r', R: chars[2]||'r' },
        E: { L: chars[3]||'r', S: chars[4]||'r', R: chars[5]||'r' },
        S: { L: chars[6]||'r', S: chars[7]||'r', R: chars[8]||'r' },
        W: { L: chars[9]||'r', S: chars[10]||'r', R: chars[11]||'r' },
      };
    } else if (chars.length >= 8) {
      return {
        N: { L: chars[1]||'r', S: chars[0]||'r', R: 'r' },
        E: { L: chars[3]||'r', S: chars[2]||'r', R: 'r' },
        S: { L: chars[5]||'r', S: chars[4]||'r', R: 'r' },
        W: { L: chars[7]||'r', S: chars[6]||'r', R: 'r' },
      };
    } else {
      return {
        N: { L: 'r', S: chars[0]||'r', R: 'r' },
        E: { L: 'r', S: chars[1]||'r', R: 'r' },
        S: { L: 'r', S: chars[2]||'r', R: 'r' },
        W: { L: 'r', S: chars[3]||'r', R: 'r' },
      };
    }
  };
  // If explicit turns mapping is provided, derive per-direction L/S/R from lane-based state string.
  const directionsFromTurns = (state, t) => {
    const base = { N: { L: 'r', S: 'r', R: 'r' }, E: { L: 'r', S: 'r', R: 'r' }, S: { L: 'r', S: 'r', R: 'r' }, W: { L: 'r', S: 'r', R: 'r' } };
    if (!state || typeof state !== 'string' || !t || typeof t !== 'object') return base;
    const chars = state.split('');
    const pickColor = (indices) => {
      const vals = (Array.isArray(indices) ? indices : [indices])
        .map((i) => (typeof i === 'number' ? chars[i] : null))
        .filter((c) => typeof c === 'string' && c.length > 0)
        .map((c) => c.toLowerCase());
      if (vals.some((c) => c === 'g')) return 'g';
      if (vals.some((c) => c === 'y')) return 'y';
      if (vals.some((c) => c === 'o')) return 'o';
      return 'r';
    };
    const out = JSON.parse(JSON.stringify(base));
    for (const dir of ['N','E','S','W']) {
      const d = t[dir] || t[dir.toLowerCase()] || {};
      out[dir].L = pickColor(d.L ?? d.l ?? []);
      out[dir].S = pickColor(d.S ?? d.s ?? []);
      out[dir].R = pickColor(d.R ?? d.r ?? []);
    }
    return out;
  };
  const directions = turns ? directionsFromTurns(phaseState, turns) : safeParse(phaseState);

  // Colors for different signal states
  const getSignalColor = (state) => {
    switch (state?.toLowerCase()) {
      case "g":
        return "#25A244"; // Green
      case "y":
        return "#FFC107"; // Yellow
      case "r":
        return "#D7263D"; // Red
      case "o":
        return "#666666"; // Off (treated as red)
      default:
        return "#666666"; // Unknown
    }
  };

  // Get arrow path for different movement types
  const getArrowPath = (movement, direction) => {
    const arrowSize = 12;

    switch (movement) {
      case "L": // Left turn arrow
        return `M 0,-${arrowSize / 2} L -${arrowSize},-${arrowSize / 2} L -${arrowSize / 2},-${arrowSize} L -${arrowSize / 2},0 L 0,0 Z`;
      case "S": // Straight arrow
        return `M -${arrowSize / 2},-${arrowSize} L 0,-${arrowSize * 1.5} L ${arrowSize / 2},-${arrowSize} L ${arrowSize / 4},-${arrowSize} L ${arrowSize / 4},${arrowSize / 2} L -${arrowSize / 4},${arrowSize / 2} L -${arrowSize / 4},-${arrowSize} Z`;
      case "R": // Right turn arrow
        return `M 0,-${arrowSize / 2} L ${arrowSize},-${arrowSize / 2} L ${arrowSize / 2},-${arrowSize} L ${arrowSize / 2},0 L 0,0 Z`;
      default:
        return "";
    }
  };

  // Calculate positions for arrows based on direction
  const getArrowPositions = (dir) => {
    const center = size / 2;
    const offset = 60; // Distance from center
    const movementOffset = 25; // Spacing between L/S/R arrows

    const positions = {
      N: {
        base: { x: center, y: center - offset },
        L: { x: center - movementOffset, y: center - offset },
        S: { x: center, y: center - offset },
        R: { x: center + movementOffset, y: center - offset },
        rotation: 0,
      },
      E: {
        base: { x: center + offset, y: center },
        L: { x: center + offset, y: center - movementOffset },
        S: { x: center + offset, y: center },
        R: { x: center + offset, y: center + movementOffset },
        rotation: 90,
      },
      S: {
        base: { x: center, y: center + offset },
        L: { x: center + movementOffset, y: center + offset },
        S: { x: center, y: center + offset },
        R: { x: center - movementOffset, y: center + offset },
        rotation: 180,
      },
      W: {
        base: { x: center - offset, y: center },
        L: { x: center - offset, y: center + movementOffset },
        S: { x: center - offset, y: center },
        R: { x: center - offset, y: center - movementOffset },
        rotation: 270,
      },
    };

    return positions[dir];
  };

  return (
    <div
      className={`traffic-light-viz ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          border: "2px solid #e0e0e0",
          borderRadius: "8px",
          backgroundColor: "white",
        }}
      >
        {/* Background intersection shape */}
        <rect
          x={size / 2 - 40}
          y={size / 2 - 40}
          width={80}
          height={80}
          fill="#f5f5f5"
          stroke="#bdbdbd"
          strokeWidth={2}
          rx={6}
        />

        {/* Direction labels */}
        {showLabels && (
          <>
            <text
              x={size / 2}
              y={30}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#666"
            >
              N
            </text>
            <text
              x={size - 20}
              y={size / 2 + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#666"
            >
              E
            </text>
            <text
              x={size / 2}
              y={size - 10}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#666"
            >
              S
            </text>
            <text
              x={20}
              y={size / 2 + 5}
              textAnchor="middle"
              fontSize="14"
              fontWeight="bold"
              fill="#666"
            >
              W
            </text>
          </>
        )}

        {/* Render arrows for each direction */}
        {Object.keys(directions).map((dir) => {
          const dirSignals = directions[dir];
          const positions = getArrowPositions(dir);

          if (!positions) return null;

          return (
            <g key={dir}>
              {/* Movement arrows: Left, Straight, Right */}
              {["L", "S", "R"].map((movement) => {
                const signal = dirSignals[movement];
                const color = getSignalColor(signal);
                const pos = positions[movement];

                if (!pos) return null;

                return (
                  <g
                    key={`${dir}-${movement}`}
                    transform={`translate(${pos.x}, ${pos.y}) rotate(${positions.rotation})`}
                  >
                    {/* Background circle */}
                    <circle
                      cx={0}
                      cy={0}
                      r={15}
                      fill="white"
                      stroke="#ccc"
                      strokeWidth={1}
                    />

                    {/* Arrow */}
                    <path
                      d={getArrowPath(movement, dir)}
                      fill={color}
                      stroke={color === "#666666" ? "#999" : "none"}
                      strokeWidth={0.5}
                    />

                    {/* Movement label */}
                    {showLabels && (
                      <text
                        x={0}
                        y={25}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#666"
                      >
                        {movement}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Phase state text at the bottom */}
        <text
          x={size / 2}
          y={size - 25}
          textAnchor="middle"
          fontSize="12"
          fontFamily="monospace"
          fill="#666"
        >
          {phaseState || "Unknown"}
        </text>
      </svg>
    </div>
  );
};

/**
 * Compact Traffic Light Phase Preview
 * Shows just the color bars for quick phase overview
 */
export const TrafficLightPhasePreview = ({
  phaseState,
  width = 100,
  height = 20,
}) => {
  if (!phaseState) return null;

  const signals = phaseState.toLowerCase().split("");
  const segmentWidth = width / Math.max(signals.length, 1);

  return (
    <div
      style={{
        display: "flex",
        width: width,
        height: height,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #ddd",
      }}
    >
      {signals.map((signal, index) => {
        const getSignalColor = (state) => {
          switch (state) {
            case "g":
              return "#25A244";
            case "y":
              return "#FFC107";
            case "r":
              return "#D7263D";
            case "o":
              return "#666666";
            default:
              return "#666666";
          }
        };

        return (
          <div
            key={index}
            style={{
              width: segmentWidth,
              height: "100%",
              backgroundColor: getSignalColor(signal),
            }}
            title={`Signal ${index + 1}: ${signal.toUpperCase()}`}
          />
        );
      })}
    </div>
  );
};

export default TrafficLightPhaseViz;
