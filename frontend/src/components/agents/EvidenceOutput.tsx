'use client';

import { BookOpen } from 'lucide-react';

export function EvidenceSummary() {
  return (
    <p className="text-sm italic text-zinc-500">
      Evidence retrieval not yet implemented (Phase 2).
    </p>
  );
}

export function EvidenceDetail() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-400 backdrop-blur-sm">
      <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
      <div>
        <p className="font-medium text-zinc-200">Evidence retrieval not yet implemented</p>
        <p className="mt-1 text-xs text-zinc-500">
          This agent will query a clinical literature index in a future phase. For now it
          passes through without producing structured output.
        </p>
      </div>
    </div>
  );
}
