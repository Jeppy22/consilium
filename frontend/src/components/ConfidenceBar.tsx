'use client';

import { useEffect, useState } from 'react';

export function ConfidenceBar({
  value,
  label,
  tone = 'blue',
}: {
  value: number;
  label?: string;
  tone?: 'blue' | 'emerald' | 'slate';
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
      <div className="flex items-baseline justify-between text-xs text-slate-600">
        <span>{label ?? 'confidence'}</span>
        <span className="font-mono tabular-nums text-slate-700">{pct}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${fillClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

const TONE_FILL: Record<'blue' | 'emerald' | 'slate', string> = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  slate: 'bg-slate-400',
};
