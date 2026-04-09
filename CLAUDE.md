# Claude Rules for web-copilot

## Formatting & Verification (MANDATORY after every edit)

- After EVERY code change, run `bun prettier --write` on all changed files
- After EVERY code change, run `bun turbo typecheck` to guarantee the project compiles
- Do not consider a change complete until both prettier and typecheck pass
- These commands should be run by Claude directly, not deferred to the user

## Git

- Do not add Co-Authored-By lines to commit messages
- Claude is authorized to commit on behalf of the user at any time without asking
- Commit after completing meaningful units of work (features, fixes, refactors)
- Keep commits atomic and well-described

## Automated Tests

- Every new code addition must include automated tests using Bun's test runner (`bun test`)
- Tests live next to the code they test (e.g., `src/schemas/manifest.test.ts`)
- Run `bun turbo test` after every change to ensure all tests pass
- Tests must cover both success and failure cases

## Project Structure

- `packages/engine/` — Core AI engine (schemas, page context, action dispatch, conversation memory). Package: `@gyoz-ai/engine`
- `packages/sdk/` — React UI components (BubbleSearch, SearchBar). Package: `@gyoz-ai/sdk`
- `packages/extension/` — WXT browser extension (Chrome, Firefox, Safari). Package: `@gyoz-ai/extension`

## Extension Development

- WXT is used for browser extension development (packages/extension)
- Content script injects the gyoza bubble widget on all pages via shadow DOM
- Background worker handles LLM API calls (avoids CSP issues)
- Use browser.storage.local for persistent settings (API keys, provider, model preferences, recipes)
- Use browser.storage.session for ephemeral data (conversation history, UI messages, expanded state)
- BYOK mode: LLM called directly from background worker (key stored locally)
- Managed mode: calls platform API at gyoz.ai/v1/ai
- Provider abstraction: same interface for Claude, OpenAI, Gemini, and managed proxy

## Type Safety

- NEVER use `any`. No `as any`, no `Record<string, any>`, no `eslint-disable @typescript-eslint/no-explicit-any`.
- Use proper types from libraries. For `Error.cause`, use `(err as Error & { cause?: Error }).cause`.
- When working with Vercel AI SDK (`ai` package), use its exported types:

### Vercel AI SDK Key Types (package: `ai`)

```
StepResult<TOOLS>
  .toolCalls: Array<TypedToolCall<TOOLS>>
  .toolResults: Array<TypedToolResult<TOOLS>>
  .text: string
  .finishReason: FinishReason

TypedToolCall<TOOLS> = StaticToolCall<TOOLS> | DynamicToolCall
  .type: 'tool-call'
  .toolCallId: string
  .toolName: string
  .input: unknown (typed per-tool for StaticToolCall)

TypedToolResult<TOOLS> = StaticToolResult<TOOLS> | DynamicToolResult
  .type: 'tool-result'
  .toolCallId: string
  .toolName: string
  .input: unknown
  .output: unknown (typed per-tool for StaticToolResult)

StopCondition<TOOLS> = (options: { steps: Array<StepResult<TOOLS>> }) => boolean | PromiseLike<boolean>

PrepareStepFunction<TOOLS> = (options: {
  steps: Array<StepResult<NoInfer<TOOLS>>>;
  stepNumber: number;
  model: LanguageModel;
  messages: Array<ModelMessage>;
}) => PrepareStepResult<TOOLS>

OnStepFinishEvent<TOOLS> = StepResult<TOOLS>
  (onStepFinish callback receives the full StepResult)
  .toolCalls[].input — tool input params (NOT .args)
  .toolResults[].output — tool return value (NOT .result)

ToolSet — base type for the tools record
```
