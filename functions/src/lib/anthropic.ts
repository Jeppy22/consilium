import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-sonnet-4-6';

let cachedClient: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. For local dev add it to functions/local.settings.json. ' +
        'In Azure, wire it as a Key Vault reference on the function app settings.'
    );
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}
