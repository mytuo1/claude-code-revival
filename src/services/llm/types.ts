export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: 'text'; text: string }>;
}

export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_use';
  text?: string;
  tool_use?: { id: string; name: string; input: any };
}

export interface LLMResponse {
  content: string;
  tool_calls?: Array<{ id: string; name: string; input: any }>;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}

export interface LLMClient {
  streamMessages(messages: LLMMessage[], tools: LLMTool[], options?: { model?: string; temperature?: number }): AsyncIterable<LLMStreamChunk>;
  getModelName(): string;
}
