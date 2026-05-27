'use client';

import { BookOpen } from 'lucide-react';

export function EvidenceSummary() {
  return (
    <p className="text-sm text-slate-500 italic">
      Evidence retrieval not yet implemented (Phase 2).
    </p>
  );
}

export function EvidenceDetail() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
      <div>
        <p className="font-medium text-slate-700">Evidence retrieval not yet implemented</p>
        <p className="mt-1 text-xs text-slate-500">
          This agent will query a clinical literature index in a future phase. For now it
          passes through without producing structured output.
        </p>
      </div>
    </div>
  );
}
