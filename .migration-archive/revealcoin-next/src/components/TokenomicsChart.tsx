'use client';

import { useState } from 'react';
import { formatNumber, RVUI_ALLOCATIONS } from '@/lib/constants';

const COLORS = [
  '#7c3aed', // violet - Ecosystem Rewards
  '#2563eb', // blue - Protocol Treasury
  '#0891b2', // cyan - Team & Founders
  '#10b981', // emerald - Community Governance
  '#f59e0b', // amber - Liquidity Provision
  '#ef4444', // red - Strategic Partners
  '#8b5cf6', // purple - Public Distribution
];

interface Segment {
  name: string;
  percentage: number;
  amount: number;
  color: string;
  startAngle: number;
  endAngle: number;
}

function buildSegments(): Segment[] {
  let angle = -90;
  return RVUI_ALLOCATIONS.map((alloc, i) => {
    const sweep = (alloc.percentage / 100) * 360;
    const segment: Segment = {
      name: alloc.name,
      percentage: alloc.percentage,
      amount: Number(alloc.amount / 1_000_000n),
      color: COLORS[i] ?? '#6b7280',
      startAngle: angle,
      endAngle: angle + sweep,
    };
    angle += sweep;
    return segment;
  });
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export function TokenomicsChart() {
  const segments = buildSegments();
  const [hovered, setHovered] = useState<number | null>(null);
  const cx = 100;
  const cy = 100;
  const r = 80;
  const strokeWidth = 28;

  return (
    <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-16">
      {/* SVG donut */}
      <div className="relative h-64 w-64 shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          <title>Tokenomics Distribution</title>
          {segments.map((seg, i) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: decorative hover highlight
            <path
              key={seg.name}
              aria-label={`${seg.name}: ${seg.percentage}%`}
              d={describeArc(cx, cy, r, seg.startAngle, seg.endAngle - 0.5)}
              fill="none"
              stroke={seg.color}
              strokeWidth={hovered === i ? strokeWidth + 6 : strokeWidth}
              strokeLinecap="butt"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hovered !== null && segments[hovered] ? (
            <>
              <p className="text-2xl font-bold text-gray-950">{segments[hovered].percentage}%</p>
              <p className="text-xs text-gray-500">{segments[hovered].name}</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-950">58.9B</p>
              <p className="text-xs text-gray-500">Total Supply</p>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {segments.map((seg, i) => (
          <li
            key={seg.name}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-pointer ${hovered === i ? 'bg-gray-100' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
            />
            <div>
              <p className="text-sm font-medium text-gray-950">
                {seg.name} <span className="text-gray-400">({seg.percentage}%)</span>
              </p>
              <p className="text-xs text-gray-500">{formatNumber(seg.amount)} RVC</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
