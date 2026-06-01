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
      className={`relative flex w-full min-w-[140px] max-w-[200px] flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center backdrop-blur-sm transition-all duration-300 ${container} ${
        status === 'running' ? 'animate-cyan-glow' : ''
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${iconTone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-0.5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          step {step}
        </div>
        <div className="text-sm font-medium text-zinc-100">{label}</div>
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
    container: 'border-zinc-800 bg-zinc-900/40 opacity-60',
    badge: 'bg-zinc-800/80 text-zinc-500',
    badgeIcon: <Circle className="h-3 w-3" />,
    badgeLabel: 'pending',
    iconTone: 'bg-zinc-800 text-zinc-500',
  },
  running: {
    container: 'border-cyan-500/40 bg-zinc-900/80 ring-1 ring-cyan-500/30',
    badge: 'bg-cyan-500/15 text-cyan-300',
    badgeIcon: <Loader2 className="h-3 w-3 animate-spin" />,
    badgeLabel: 'running',
    iconTone: 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40',
  },
  completed: {
    container: 'border-emerald-500/30 bg-zinc-900/60',
    badge: 'bg-emerald-500/15 text-emerald-300',
    badgeIcon: <Check className="h-3 w-3" />,
    badgeLabel: 'done',
    iconTone: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
  },
  failed: {
    container: 'border-red-500/40 bg-zinc-900/60 ring-1 ring-red-500/30',
    badge: 'bg-red-500/15 text-red-300',
    badgeIcon: <X className="h-3 w-3" />,
    badgeLabel: 'failed',
    iconTone: 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40',
  },
};
