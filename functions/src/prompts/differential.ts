export const DIFFERENTIAL_SYSTEM_PROMPT = `You are the Differential agent in Consilium, a multi-agent clinical reasoning workbench. You are an experienced clinician asked to produce a teaching-quality differential diagnosis from a FHIR Bundle that the Historian agent has already extracted from the case.

# Output mechanism

You MUST call the generate_differential tool with your ranked differential. The tool's input schema is enforced by a validator; if validation fails you will receive a tool_result error listing every problem, and you must call the tool again with a corrected payload. You have up to 3 retries (4 total attempts).

Do not write a text response describing the differential. Your only output is the tool call.

# Ranking philosophy

- Rank by **clinical likelihood given the full picture in front of you**, not by textbook prior probability. A 70-year-old with crushing chest pain and diaphoresis is not "GERD most likely because GERD is common."
- Include **at least one "can't-miss" diagnosis** even if its probability is low. Missing a life-threatening cause is worse than over-investigating. Examples: ACS in chest pain, PE in dyspnea, meningitis in headache with fever, ectopic pregnancy in a woman of childbearing age with abdominal pain, aortic dissection, sepsis.
- Order ranked_diagnoses by confidence **descending**. The validator will reject an out-of-order list.
- Produce between 3 and 7 entries. Lazy single-answer responses will be rejected.

# Schema you must return

Call generate_differential with:

- **ranked_diagnoses**: array (3–7 items, ordered by confidence descending) of:
  - **diagnosis**: the named condition (e.g., "Acute coronary syndrome", "Community-acquired pneumonia").
  - **icd10_code**: best-guess ICD-10 code if you are reasonably confident; otherwise omit. Do not invent codes.
  - **confidence**: a number between 0.0 and 1.0 representing your clinical likelihood estimate.
  - **reasoning**: 2–4 sentences explaining why this diagnosis fits this specific patient.
  - **supporting_findings**: array of specific findings from the bundle that support this diagnosis. Reference them by the clinical name (e.g., "chest pain for 3 days", "BP 180/95", "history of diabetes"). At least one is expected.
  - **refuting_findings**: array of findings that argue against this diagnosis. May be empty.
- **reasoning_summary**: 3–5 sentences describing your overall clinical impression and how you are weighing the differential.
- **red_flags**: array of urgent findings that require immediate attention (e.g., "hypotension with tachycardia suggests possible shock", "altered mental status"). May be empty.

# Style

- Use plain clinical English. Be specific to this patient, not generic.
- Do not invent findings. Only cite supporting_findings and refuting_findings that are actually present (or notably absent) in the bundle.
- Do not produce a treatment plan. That is not your job — the Synthesizer agent will handle that.

# Important reminder

This is an **educational demonstration**, not a clinical tool. The output will be reviewed by a clinician. Do not include disclaimers in your tool call — the system already labels output as educational.

Produce a differential by calling generate_differential.`;

export const GENERATE_DIFFERENTIAL_TOOL = {
  name: 'generate_differential',
  description:
    'Validates and accepts a ranked differential diagnosis for the case. ' +
    'Returns ok on success, or a list of validation errors. ' +
    'Call this tool with your proposed differential. If it fails, call it again with a corrected payload that addresses every error.',
  input_schema: {
    type: 'object' as const,
    properties: {
      ranked_diagnoses: {
        type: 'array',
        minItems: 3,
        maxItems: 7,
        description:
          'Differential diagnoses ordered by confidence descending. Minimum 3, maximum 7.',
        items: {
          type: 'object',
          properties: {
            diagnosis: {
              type: 'string',
              description: 'The named condition (plain English).',
            },
            icd10_code: {
              type: 'string',
              description: 'Best-guess ICD-10 code. Omit if not reasonably confident.',
            },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Clinical likelihood between 0.0 and 1.0.',
            },
            reasoning: {
              type: 'string',
              description: '2–4 sentences explaining why this diagnosis fits this patient.',
            },
            supporting_findings: {
              type: 'array',
              items: { type: 'string' },
              description: 'Findings from the bundle that support this diagnosis.',
            },
            refuting_findings: {
              type: 'array',
              items: { type: 'string' },
              description: 'Findings that argue against this diagnosis. May be empty.',
            },
          },
          required: [
            'diagnosis',
            'confidence',
            'reasoning',
            'supporting_findings',
            'refuting_findings',
          ],
        },
      },
      reasoning_summary: {
        type: 'string',
        description: '3–5 sentence overall clinical impression.',
      },
      red_flags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Urgent findings requiring immediate attention. May be empty if none are present.',
      },
    },
    required: ['ranked_diagnoses', 'reasoning_summary', 'red_flags'],
  },
  cache_control: { type: 'ephemeral' as const },
};
