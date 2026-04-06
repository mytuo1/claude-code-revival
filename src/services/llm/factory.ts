import type { LLMClient } from './types.js';
import { createOpenAICompatibleClient } from './providers/openai.js';

export type LLMProvider = 'openai';

export function createLLMClient(config: { model?: string; temperature?: number } = {}): LLMClient {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) || 'openai';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required. See .env.example');
  }

  if (provider === 'openai') {
    return createOpenAICompatibleClient(apiKey, config.model || 'gpt-4o');
  }

  throw new Error(`Unsupported provider: ${provider}. Only 'openai' is supported in this de-Anthropicized build.`);
}
