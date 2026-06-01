'use client';

import { useState } from 'react';
import {
  ClipboardList,
  ListOrdered,
  Search,
  Swords,
  Sparkles,
  ChevronRight,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

type AgentPreview = {
  label: string;
  role: string;
  Icon: LucideIcon;
};

const AGENTS: AgentPreview[] = [
  { label: 'Historian', role: 'Structures the case into FHIR', Icon: ClipboardList },
  { label: 'Differential', role: 'Ranks likely diagnoses', Icon: ListOrdered },
  { label: 'Evidence', role: 'Retrieves clinical literature', Icon: Search },
  { label: "Devil's Advocate", role: 'Challenges the reasoning', Icon: Swords },
  { label: 'Synthesizer', role: 'Writes the final note', Icon: Sparkles },
];

export function LandingScreen({ onStart }: { onStart: () => void }) {
  const [howOpen, setHowOpen] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(34, 211, 238, 0.08), transparent 60%)',
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-12">
        <div className="flex-1 flex flex-col justify-center space-y-12 py-8">
          <header className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400 backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="font-mono uppercase tracking-wider">
                Multi-agent reasoning
              </span>
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-zinc-50 md:text-6xl">
              Consilium
            </h1>
            <p className="mx-auto max-w-2xl text-base text-zinc-400 md:text-lg">
              Multi-agent clinical reasoning. Watch five specialized agents reason
              through a case — and challenge each other.
            </p>
          </header>

          <LandingPipeline />

          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={onStart}
              className="group inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_30px_-5px_rgba(34,211,238,0.5)] transition-all duration-200 hover:bg-cyan-400 hover:shadow-[0_0_40px_-5px_rgba(34,211,238,0.7)]"
            >
              New case
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>

            <button
              type="button"
              onClick={() => setHowOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform duration-200 ${howOpen ? 'rotate-90' : ''}`}
              />
              How it works
            </button>

            {howOpen && (
              <div className="mx-auto max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-sm text-zinc-400 backdrop-blur-sm">
                <p>
                  You submit a structured case. The Historian normalizes it into a
                  FHIR bundle. The Differential agent produces a ranked list of
                  diagnoses with confidence and reasoning. The Devil&apos;s Advocate
                  then attacks that differential — naming missed dangerous diagnoses,
                  anchoring bias, and weak reasoning. The Synthesizer weighs all of
                  it and writes the final clinical note: revised confidences, concrete
                  next steps, and a teaching point.
                </p>
              </div>
            )}
          </div>
        </div>

        <footer className="pt-12 text-center text-xs text-zinc-500">
          Educational demonstration. Not for clinical use.
        </footer>
      </div>
    </main>
  );
}

function LandingPipeline() {
  return (
    <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:gap-0">
      {AGENTS.map((agent, i) => (
        <div
          key={agent.label}
          className="flex flex-col items-center gap-2 md:flex-1 md:flex-row md:gap-0"
        >
          <div className="flex justify-center md:flex-1">
            <LandingNode {...agent} />
          </div>
          {i < AGENTS.length - 1 && (
            <div
              aria-hidden
              className="mx-auto h-8 w-px animate-flow-vertical md:mx-2 md:h-px md:w-12 md:flex-shrink-0 md:animate-flow"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function LandingNode({ label, role, Icon }: AgentPreview) {
  return (
    <div className="group relative flex w-full min-w-[150px] max-w-[210px] flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/40 hover:bg-zinc-900/80">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800/80 ring-1 ring-zinc-700 transition-colors group-hover:bg-cyan-500/10 group-hover:ring-cyan-500/40">
        <Icon className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-cyan-300" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-zinc-100">{label}</div>
        <div className="text-[11px] leading-snug text-zinc-500">{role}</div>
      </div>
    </div>
  );
}
