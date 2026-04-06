import OpenAI from 'openai';
import type { LLMClient, LLMMessage, LLMTool, LLMStreamChunk } from '../types.js';

export function createOpenAICompatibleClient(apiKey: string, defaultModel: string): LLMClient {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: false });

  return {
    async *streamMessages(messages: LLMMessage[], tools: LLMTool[], options: { model?: string; temperature?: number } = {}) {
      const model = options.model || defaultModel;

      const openaiTools = tools.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }));

      const stream = await client.chat.completions.create({
        model,
        messages: messages as any,
        tools: openaiTools.length ? openaiTools : undefined,
        temperature: options.temperature ?? 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          yield { type: 'text' as const, text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function?.name) {
              yield {
                type: 'tool_use' as const,
                tool_use: {
                  id: tc.id || '',
                  name: tc.function.name,
                  input: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
                },
              };
            }
          }
        }
      }
    },
    getModelName() {
      return defaultModel;
    },
  };
}
