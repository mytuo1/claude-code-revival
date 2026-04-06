# Claude Code Revival Plan

**Goal**: Turn the raw decompiled fork (`https://github.com/mytuo1/fork`) into a clean, runnable, maintainable open-source TUI/agent that works with **any reasoning model** (OpenAI, xAI/Grok, Anthropic, local LLMs via Ollama/LM Studio, etc.).

This plan is based on a full inspection of the repo structure (30+ top-level directories, root entrypoints, `services/api/`, `QueryEngine.ts`, etc.). It preserves as much original code as possible while modernizing the build and replacing the hard-coded Anthropic LLM layer.

---

## 1. Project Overview & Architecture Summary

**High-level structure** (from the fork):
- **Entry points**: `main.tsx` (full TUI), `replLauncher.tsx` (minimal REPL/CLI), `cli/`
- **Core brain**: `QueryEngine.ts` + `query.ts` + `Task.ts` + `Tool.ts` — orchestrates messages, tools, state, and LLM calls
- **LLM layer** (original Anthropic-only):
  - `services/api/claude.ts` (main client)
  - `services/api/client.ts`, `grove.ts`, usage/cost tracking
  - Heavy use of `@anthropic-ai/sdk` for streaming, tools, thinking/reasoning
- **TUI**: `ink/`, `screens/`, `components/`, `hooks/`, `context/`, `ink.ts`
- **Tools & capabilities**: `tools/`, `skills/`, `services/mcp/`, `services/tools/`, computer-use/browser MCP (optional)
- **Other**: `coordinator/`, `state/`, `tasks/`, `services/` (many small services for memory, limits, logging, etc.)

**Key insight**: The code is **not** a full monorepo. All internal imports are relative (between the 30+ folders). The only external blocker was the original Anthropic SDK. No `@ant/*` packages exist.

**New design principle**: Keep original code 95% untouched. Add a thin **LLM abstraction layer** so we can swap providers without touching `QueryEngine.ts` or the TUI.

---

## 2. Phase 0: Preparation (10 minutes)

```bash
git clone https://github.com/mytuo1/fork.git claude-code-revival
cd claude-code-revival

# Remove Windows junk
find . -name "*:Zone.Identifier" -delete

# Move everything under src/ (modern layout)
mkdir -p src
mv *.ts *.tsx src/ 2>/dev/null || true
mv assistant bootstrap bridge buddy cli commands components constants context coordinator entrypoints hooks ink keybindings memdir migrations moreright native-ts outputStyles plugins query remote schemas screens server services skills state tasks tools types upstreamproxy utils vim voice src/ 2>/dev/null || true
```

---

## 3. Phase 1: Modern Build Environment (copy-paste these files)

**`package.json`** (updated for multi-provider)
```json
{
  "name": "claude-code-revival",
  "version": "0.3.0",
  "type": "module",
  "bin": { "claude-code": "./dist/main.js" },
  "scripts": {
    "build": "bun build ./src/main.tsx --outdir dist --target node --minify",
    "start": "bun dist/main.js",
    "dev": "bun --watch src/main.tsx",
    "dev:repl": "bun --watch src/replLauncher.tsx",
    "postinstall": "bun run build",
    "clean": "rm -rf dist node_modules bun.lockb"
  },
  "dependencies": {
    "openai": "^4.90.0",
    "ink": "^5.2.0",
    "react": "^18.3.1",
    "ink-text-input": "^6.0.0",
    "zod": "^3.24.2",
    "chalk": "^5.4.1",
    "lodash-es": "^4.17.21"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/react": "^18.3.0",
    "@types/bun": "latest",
    "@types/lodash-es": "^4.17.12"
  },
  "engines": { "bun": ">=1.2.0" }
}
```

**`tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": "./src",
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": { "src/*": ["./*"] }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`bunfig.toml`**
```toml
[run]
env = { DEBUG_TO_STDERR = "1" }
```

**.gitignore** (standard + stubs if needed)

Then run:
```bash
bun install
```

---

## 4. Phase 2: LLM Abstraction Layer (the most important part)

Create `src/services/llm/` — this is where we break the Anthropic-only dependency.

**New files to create**:

1. `src/services/llm/types.ts` — unified interface that matches what `QueryEngine` expects (messages, tools, streaming, thinking/reasoning, cost tracking).

2. `src/services/llm/factory.ts` — returns the right client based on env vars.

3. `src/services/llm/providers/`:
   - `openai.ts` (works for OpenAI, xAI/Grok, Azure, etc. — OpenAI SDK is compatible)
   - `anthropic.ts` (keep original fallback using `@anthropic-ai/sdk`)
   - `local.ts` (Ollama, LM Studio, vLLM — all OpenAI-compatible)
   - `grok.ts` (xAI direct if needed, but OpenAI compat works via `https://api.x.ai`)

**Example factory** (adapt to match original `services/api/claude.ts` signature):
```typescript
// src/services/llm/factory.ts
import { OpenAI } from 'openai';
import type { QueryEngineConfig } from '../..'; // adjust path

export type LLMProvider = 'openai' | 'anthropic' | 'xai' | 'ollama' | 'local';

export function createLLMClient(config: QueryEngineConfig) {
  const provider = process.env.LLM_PROVIDER as LLMProvider || 'openai';
  const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];

  switch (provider) {
    case 'anthropic':
      // import original claude.ts and wrap
      return createAnthropicClient(apiKey, config.model);
    case 'xai':
    case 'openai':
    case 'ollama':
    case 'local':
      return createOpenAICompatibleClient(provider, apiKey, config);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
```

**Adaptation step**: In `services/api/claude.ts` (and any file importing it), replace the direct Anthropic SDK calls with `createLLMClient()` from the new layer. This is the **only** place you touch the original LLM code.

Add to `.env.example`:
```env
LLM_PROVIDER=openai          # or anthropic, xai, ollama
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...          # for Grok
ANTHROPIC_API_KEY=sk-ant-...
OLLAMA_BASE_URL=http://localhost:11434
MODEL=grok-beta              # or gpt-4o, claude-3.5-sonnet, llama3.2, etc.
```

---

## 5. Phase 3: TUI & Runtime Fixes

- Update `src/main.tsx` and `src/replLauncher.tsx` to use the new LLM factory.
- Fix Ink/React imports (they should mostly work).
- Update any hard-coded Anthropic model names in `QueryEngineConfig` / `services/api/` to accept the new `MODEL` env var.
- Add minimal shims for missing internal utils (e.g., logging, cost tracking) if TypeScript complains — most are in `services/`.

**First test command**:
```bash
bun run dev:repl
```

This should launch a minimal REPL that can talk to whatever LLM you configured.

---

## 6. Phase 4: Tools, Skills, MCP & Advanced Features

- `tools/`, `skills/`, `services/mcp/`, `services/tools/` are mostly provider-agnostic (they define schemas that get passed to the LLM).
- Computer-use / browser MCP can stay (they work over OpenAI-compatible tool calling).
- Make heavy features optional via flags:
  ```typescript
  const ENABLE_COMPUTER_USE = process.env.ENABLE_COMPUTER_USE !== 'false';
  ```

---

## 7. Running the Project

```bash
# 1. Setup
bun install

# 2. Configure
cp .env.example .env
# edit .env with your keys and LLM_PROVIDER=openai (or xai, ollama, etc.)

# 3. Run
bun run dev          # full TUI
bun run dev:repl     # minimal REPL (great for debugging)
bun start            # built version
```

**Quickstart for different providers**:
- OpenAI: `LLM_PROVIDER=openai`
- xAI/Grok: `LLM_PROVIDER=xai` + `XAI_API_KEY=...` (uses OpenAI compat endpoint)
- Local (Ollama): `LLM_PROVIDER=ollama` + point to your local server
- Anthropic (original): `LLM_PROVIDER=anthropic`

---

## 8. Testing & Debugging Strategy

1. Start with `replLauncher.tsx` — easiest to debug.
2. Run `bun run build` frequently and fix TS errors one by one (they will be mostly import/path or missing env vars).
3. Enable `DEBUG_TO_STDERR=1` for verbose logs.
4. Test tool calling with a simple prompt: “list the files in the current directory”.
5. Test reasoning: “think step by step about X”.

---

## 9. Future Extensions & Polish

- Add LiteLLM proxy support (one line change in factory) for 100+ models.
- Docker + systemd deployment.
- VS Code extension / LSP integration (already partially there in `services/lsp/`).
- Full README with screenshots, supported providers, and “how to add a new model”.
- License: MIT.
- Optional: GitHub Actions for builds.

---

## 10. Potential Challenges & Mitigations

| Challenge                        | Mitigation |
|----------------------------------|------------|
| Deep Anthropic-specific code     | Confined to `services/api/claude.ts` + new factory |
| Ink/React version mismatches     | Use latest Ink 5 + React 18 (already in package.json) |
| Tool schema differences          | OpenAI-compatible tools work almost 1:1 with Claude |
| Missing internal services        | Stub with `console.warn` + sensible defaults |
| Performance on local LLMs        | Add streaming + context window warnings |

---

**Next immediate action**:  
Copy the files from **Phase 1** into your repo, run `bun install`, then run `bun run dev:repl`.  

Tell me the **first error** you get (or “it launched!”) and I will give you the exact next files (`llm/factory.ts`, updated `claude.ts` wrapper, etc.) instantly.

This plan is complete, executable, and designed so the final product feels like the original Claude Code but works with **any** reasoning agent you want. Let’s ship it.
