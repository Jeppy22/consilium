'use client';

import { Check, X, Loader2, Circle, type LucideIcon } from 'lucide-react';

export type AgentStatus = 'pending' | 'running' | 'completed' | 'failed';

export function AgentNode({
  step,
  label,
  Icon,
  status,
}: {
  step: number;
  label: string;
  Icon: LucideIcon;
  status: AgentStatus;
}) {
  const { container, badge, badgeIcon, badgeLabel, iconTone } = STYLES[status];

  return (
    <div
      className={`relative flex w-full min-w-[140px] max-w-[200px] flex-col items-center gap-2 rounded-lg border px-3 py-3 text-center transition-all duration-300 ${container} ${
        status === 'running' ? 'animate-pulse' : ''
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${iconTone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-0.5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          step {step}
        </div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
      </div>
      <div
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge}`}
      >
        {badgeIcon}
        <span>{badgeLabel}</span>
      </div>
    </div>
  );
}

const STYLES: Record<
  AgentStatus,
  {
    container: string;
    badge: string;
    badgeIcon: React.ReactNode;
    badgeLabel: string;
    iconTone: string;
  }
> = {
  pending: {
    container: 'border-slate-200 bg-slate-50/60 opacity-60',
    badge: 'bg-slate-100 text-slate-500',
    badgeIcon: <Circle className="h-3 w-3" />,
    badgeLabel: 'pending',
    iconTone: 'bg-slate-100 text-slate-400',
  },
  running: {
    container: 'border-blue-300 bg-white shadow-sm ring-2 ring-blue-100',
    badge: 'bg-blue-100 text-blue-700',
    badgeIcon: <Loader2 className="h-3 w-3 animate-spin" />,
    badgeLabel: 'running',
    iconTone: 'bg-blue-100 text-blue-600',
  },
  completed: {
    container: 'border-emerald-200 bg-white',
    badge: 'bg-emerald-100 text-emerald-700',
    badgeIcon: <Check className="h-3 w-3" />,
    badgeLabel: 'done',
    iconTone: 'bg-emerald-100 text-emerald-600',
  },
  failed: {
    container: 'border-red-300 bg-white ring-2 ring-red-100',
    badge: 'bg-red-100 text-red-700',
    badgeIcon: <X className="h-3 w-3" />,
    badgeLabel: 'failed',
    iconTone: 'bg-red-100 text-red-600',
  },
};
