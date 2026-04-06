import type { LLMResponse } from './llm/types.js';
import { log } from '../utils/log.js';

export class UsageTracker {
  private totalInput = 0;
  private totalOutput = 0;

  trackResponse(response: LLMResponse) {
    if (response.usage) {
      this.totalInput += response.usage.input_tokens;
      this.totalOutput += response.usage.output_tokens;
      log(`Tokens used this call: ${response.usage.total_tokens} (in/out: ${response.usage.input_tokens}/${response.usage.output_tokens})`);
      debugReporter.record('usage_tracked', response.usage); // ties into your debug reporting idea
    }
  }

  getSummary() {
    return { input: this.totalInput, output: this.totalOutput, total: this.totalInput + this.totalOutput };
  }
}

export const usageTracker = new UsageTracker();
