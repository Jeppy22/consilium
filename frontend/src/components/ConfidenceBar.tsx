'use client';

import { useEffect, useState } from 'react';

export function ConfidenceBar({
  value,
  label,
  tone = 'cyan',
}: {
  value: number;
  label?: string;
  tone?: 'cyan' | 'emerald' | 'zinc';
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);

  const [width, setWidth] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const fillClass = TONE_FILL[tone];

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-xs text-zinc-400">
        <span>{label ?? 'confidence'}</span>
        <span className="font-mono tabular-nums text-zinc-200">{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fillClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

const TONE_FILL: Record<'cyan' | 'emerald' | 'zinc', string> = {
  cyan: 'bg-cyan-400',
  emerald: 'bg-emerald-400',
  zinc: 'bg-zinc-500',
};
