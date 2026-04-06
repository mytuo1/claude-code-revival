import { log } from '../utils/log.js'; // adjust path if your logger lives elsewhere in src/utils/

export class DebugReporter {
  private messages: string[] = [];

  record(message: string, data?: any) {
    const entry = data ? `${message} ${JSON.stringify(data)}` : message;
    this.messages.push(entry);
    log(`[DEBUG] ${entry}`); // always visible in console for now
  }

  getAllDebugMessages(): string[] {
    return [...this.messages];
  }

  clear() {
    this.messages = [];
  }

  // Future reporting feature hook — expand this later
  async generateReport(): Promise<string> {
    return `Debug Report (${this.messages.length} entries):\n${this.messages.join('\n')}`;
  }
}

export const debugReporter = new DebugReporter();
