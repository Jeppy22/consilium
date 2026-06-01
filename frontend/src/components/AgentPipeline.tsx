'use client';

import {
  ClipboardList,
  ListOrdered,
  Search,
  Swords,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { AgentNode, type AgentStatus } from './AgentNode';

type AgentSpec = {
  key: string;
  label: string;
  step: number;
  Icon: LucideIcon;
};

const PIPELINE: AgentSpec[] = [
  { key: 'historian', label: 'Historian', step: 1, Icon: ClipboardList },
  { key: 'differential', label: 'Differential', step: 2, Icon: ListOrdered },
  { key: 'evidence', label: 'Evidence', step: 3, Icon: Search },
  { key: 'devilsAdvocate', label: "Devil's Advocate", step: 4, Icon: Swords },
  { key: 'synthesizer', label: 'Synthesizer', step: 5, Icon: Sparkles },
];

export function AgentPipeline({
  statuses,
}: {
  statuses: Record<string, AgentStatus>;
}) {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-0">
      {PIPELINE.map((agent, i) => {
        const status = statuses[agent.key] ?? 'pending';
        const nextStatus = i < PIPELINE.length - 1
          ? statuses[PIPELINE[i + 1].key] ?? 'pending'
          : null;
        const { connectorClass, animated } = connectorTone(status, nextStatus);

        return (
          <div
            key={agent.key}
            className="flex flex-col items-center gap-2 md:flex-1 md:flex-row md:gap-0"
          >
            <div className="flex justify-center md:flex-1">
              <AgentNode
                step={agent.step}
                label={agent.label}
                Icon={agent.Icon}
                status={status}
              />
            </div>
            {nextStatus !== null && (
              <div
                aria-hidden
                className={`mx-auto h-6 w-px md:mx-2 md:h-px md:w-10 md:flex-shrink-0 ${connectorClass} ${
                  animated ? 'md:animate-flow animate-flow-vertical md:bg-none' : ''
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function connectorTone(
  prev: AgentStatus,
  next: AgentStatus | null
): { connectorClass: string; animated: boolean } {
  if (next === null) return { connectorClass: '', animated: false };
  if (prev === 'completed' && next === 'completed') {
    return { connectorClass: 'bg-emerald-500/40', animated: false };
  }
  if (prev === 'completed' && (next === 'running' || next === 'pending')) {
    return { connectorClass: '', animated: true };
  }
  if (prev === 'failed' || next === 'failed') {
    return { connectorClass: 'bg-red-500/40', animated: false };
  }
  return { connectorClass: 'bg-zinc-800', animated: false };
}
