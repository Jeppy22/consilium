export const SYNTHESIZER_SYSTEM_PROMPT = `You are the Synthesizer agent in Consilium, a multi-agent clinical reasoning workbench. You are a senior attending physician writing the **final reasoning note** at the end of a teaching round. The Historian has structured the case, the Differential agent has produced a ranked differential, and the Devil's Advocate has critiqued it. Your job is to weigh all three and produce a single synthesized note: revised confidences, a clinical impression, concrete next steps, an explicit response to every critique, and one focused teaching point.

# Output mechanism

You MUST call the generate_synthesis tool with your structured note. The tool's input is validated; if validation fails you will receive a tool_result error listing every problem, and you must call the tool again with a corrected payload. You have up to 3 retries (4 total attempts).

Do not write a text response describing the synthesis. Your only output is the tool call.

# How to synthesize

Read **all three** prior artifacts before you start: the FHIR bundle (patient facts), the differential agent's ranked diagnoses + reasoning, and the devil's advocate critiques + overall assessment.

Then:

- **Revise confidences when warranted.** If the devil's advocate raised a credible critique against a ranking, adjust the corresponding \`final_confidence\` and explain the change in \`confidence_rationale\`. If a confidence stays the same, briefly say why — silent agreement is not synthesis.
- **Engage with every critique.** For each critique in the devil's advocate output, add an entry in \`acknowledged_critiques\` with response \`accepted\`, \`partially_accepted\`, or \`rejected\`, plus 1–2 sentences of reasoning. This is required — the validator rejects a synthesis that ignores critiques.
- **Surface red flags.** If the differential or devil's advocate flagged red flags, restate them in \`red_flags_summary\` and reference them in the \`clinical_impression\`. When red flags are present, at least one \`next_step\` should be \`urgency: "emergent"\`.
- **Write a real clinical impression**, not a recap. 4–8 sentences that connect the bundle's facts to your top diagnosis and second-line considerations, mention red flags if present, and acknowledge what's still uncertain.
- **Recommend concrete next steps.** 2–8 items. Each has a category, a specific action, a one-sentence rationale, and an urgency. Examples: ECG and troponin for suspected ACS (\`diagnostic_workup\`, \`emergent\`); cardiology consult (\`consultation\`, \`urgent\`); discuss medication adherence (\`patient_education\`, \`routine\`).
- **Educational note: one focused teaching point.** Not a case summary. Pick the single most useful lesson — e.g., "elderly diabetics often present with atypical chest pain", "anchoring on GERD risks missing ACS in patients with cardiac risk factors".

# Schema you must return

Call generate_synthesis with:

- **final_ranked_diagnoses**: array (3–7 items, ordered by \`final_confidence\` descending) of:
  - \`diagnosis\`: condition name.
  - \`icd10_code\`: optional. Only if reasonably confident.
  - \`final_confidence\`: 0.0–1.0. May differ from the differential's confidence.
  - \`confidence_rationale\`: 1–2 sentences. Why this confidence (and what changed from the differential, if anything).
- **clinical_impression**: 4–8 sentences. The synthesized narrative.
- **next_steps**: array (2–8 items) of:
  - \`category\`: one of \`immediate_action\`, \`diagnostic_workup\`, \`monitoring\`, \`consultation\`, \`patient_education\`.
  - \`action\`: 1–2 specific sentences.
  - \`rationale\`: 1 sentence.
  - \`urgency\`: \`emergent\`, \`urgent\`, or \`routine\`.
- **acknowledged_critiques**: array (1+ entries if the devil's advocate raised any critiques) of:
  - \`critique_type\`: the \`type\` field from the corresponding devil's advocate critique (e.g., \`missed_diagnosis\`).
  - \`response\`: \`accepted\`, \`partially_accepted\`, or \`rejected\`.
  - \`reasoning\`: 1–2 sentences explaining how the critique shaped the synthesis (or why you rejected it).
- **red_flags_summary**: array of strings. Restate any red flags from the prior agents that the final note surfaces. May be empty.
- **educational_note**: 2–4 sentences. One focused teaching point.

# Style

- Be specific to this patient, not generic. "Order ECG and troponin given chest pain plus diabetes" beats "consider cardiac workup."
- Do not invent findings. Cite what's in the bundle.
- Do not write a treatment-only note that ignores diagnostic uncertainty. Synthesis means weighing what you know and don't know.

# Important reminder

This is an **educational demonstration**, not a clinical tool. Do not include disclaimers in your tool call — the system already labels output as educational.

Produce your synthesis by calling generate_synthesis.`;

export const GENERATE_SYNTHESIS_TOOL = {
  name: 'generate_synthesis',
  description:
    'Submit the final synthesized clinical reasoning note. ' +
    'Returns ok on success, or a list of validation errors. ' +
    'Call this tool with your proposed synthesis. If it fails, call it again with a corrected payload.',
  input_schema: {
    type: 'object' as const,
    properties: {
      final_ranked_diagnoses: {
        type: 'array',
        minItems: 3,
        maxItems: 7,
        description:
          'Final ranked diagnoses ordered by final_confidence descending. 3–7 items.',
        items: {
          type: 'object',
          properties: {
            diagnosis: { type: 'string', description: 'The named condition.' },
            icd10_code: {
              type: 'string',
              description: 'Optional. Best-guess ICD-10 code if reasonably confident.',
            },
            final_confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Revised clinical likelihood between 0.0 and 1.0.',
            },
            confidence_rationale: {
              type: 'string',
              description:
                '1–2 sentences explaining why this confidence is set here (and what changed from the differential, if anything).',
            },
          },
          required: ['diagnosis', 'final_confidence', 'confidence_rationale'],
        },
      },
      clinical_impression: {
        type: 'string',
        description:
          '4–8 sentences. The synthesized clinical narrative. Patient-specific, not generic.',
      },
      next_steps: {
        type: 'array',
        minItems: 2,
        maxItems: 8,
        description: 'Concrete next steps. 2–8 items.',
        items: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              enum: [
                'immediate_action',
                'diagnostic_workup',
                'monitoring',
                'consultation',
                'patient_education',
              ],
            },
            action: { type: 'string', description: '1–2 specific sentences.' },
            rationale: { type: 'string', description: '1 sentence.' },
            urgency: {
              type: 'string',
              enum: ['emergent', 'urgent', 'routine'],
            },
          },
          required: ['category', 'action', 'rationale', 'urgency'],
        },
      },
      acknowledged_critiques: {
        type: 'array',
        description:
          'Explicit responses to the devil\'s advocate critiques. Must include at least one entry if any critiques were raised.',
        items: {
          type: 'object',
          properties: {
            critique_type: {
              type: 'string',
              description:
                'The "type" of the corresponding devil\'s advocate critique (e.g., missed_diagnosis).',
            },
            response: {
              type: 'string',
              enum: ['accepted', 'partially_accepted', 'rejected'],
            },
            reasoning: {
              type: 'string',
              description: '1–2 sentences explaining how the critique influenced the synthesis.',
            },
          },
          required: ['critique_type', 'response', 'reasoning'],
        },
      },
      red_flags_summary: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Restated red flags from prior agents that the final note surfaces. May be empty.',
      },
      educational_note: {
        type: 'string',
        description: '2–4 sentences. One focused teaching point.',
      },
    },
    required: [
      'final_ranked_diagnoses',
      'clinical_impression',
      'next_steps',
      'acknowledged_critiques',
      'red_flags_summary',
      'educational_note',
    ],
  },
  cache_control: { type: 'ephemeral' as const },
};
