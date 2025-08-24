import React from 'react';

interface Point {
  lat: number;
  lng: number;
  x: number;
  y: number;
}

interface DrawingOverlayProps {
  width: number;
  height: number;
  points: Point[];
  isDrawing: boolean;
}

export default function DrawingOverlay({ width, height, points, isDrawing }: DrawingOverlayProps) {
  if (!isDrawing || points.length === 0) return null;

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 1000,
        pointerEvents: 'none',
      }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Líneas entre puntos */}
      {points.length > 1 && (
        <path
          d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
          fill="none"
          stroke="red"
          strokeWidth="4"
          strokeDasharray="8,8"
        />
      )}

      {/* Puntos */}
      {points.map((point, index) => (
        <g key={`drawing-point-${index}`}>
          <circle
            cx={point.x}
            cy={point.y}
            r="12"
            fill="white"
            stroke="black"
            strokeWidth="2"
          />
          <circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill="red"
          />
          <text
            x={point.x}
            y={point.y}
            dy="5"
            textAnchor="middle"
            fill="white"
            fontSize="12px"
            fontWeight="bold"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
