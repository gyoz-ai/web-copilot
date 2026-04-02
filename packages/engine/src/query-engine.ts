import type { HistoryEntry } from "./conversation-history";
import { ConversationHistory } from "./conversation-history";

// ─── Config types ───

export interface LLMProvider {
  type: "legacy" | "byok";
}

export interface LegacyProvider extends LLMProvider {
  type: "legacy";
  query(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown>;
}

export interface BYOKProvider extends LLMProvider {
  type: "byok";
  /** Execute a streaming query. The caller (extension) provides the streaming implementation. */
  query(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    tools: Record<string, unknown>,
    maxSteps: number,
    onStepFinish?: (
      toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>,
    ) => void,
  ): Promise<{
    text: string;
    toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
  }>;
}

export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface QueryError {
  type: "network" | "api" | "validation" | "resource_exhausted" | "unknown";
  message: string;
  status?: number;
  provider?: string;
  retryable: boolean;
}

export interface QueryEngineConfig {
  provider: LegacyProvider | BYOKProvider;
  systemPromptBuilder: (
    mode: "manifest" | "no-manifest",
    caps: Record<string, boolean>,
    yolo: boolean,
  ) => string;
  userPromptBuilder: (params: UserPromptParams) => string;
  /** Tool definitions — passed to BYOK provider. */
  tools?: Record<string, unknown>;
  /** Max tool calling steps per query (default: 10) */
  maxToolSteps?: number;
  /** Yolo mode toggle */
  yoloMode?: boolean;
  /** JSON schema for legacy structured output */
  jsonSchema?: Record<string, unknown>;

  // Callbacks
  onStreamEvent?: (event: StreamEvent) => void;
  onStepFinish?: (
    toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>,
  ) => void;
  onError?: (error: QueryError) => void;
  onRetry?: (attempt: number, error: QueryError, nextBackoffMs: number) => void;

  // History config
  maxHistoryMessages?: number;
  maxEstimatedTokens?: number;
}

export interface UserPromptParams {
  query: string;
  recipe?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  context?: Record<string, unknown>;
  pageContext?: string;
}

export interface QueryInput {
  query: string;
  manifestMode: boolean;
  recipe?: string;
  htmlSnapshot?: string;
  currentRoute?: string;
  pageContext?: string;
  context?: Record<string, unknown>;
  capabilities?: Record<string, boolean>;
}

export interface QueryResult {
  messages: string[];
  clarify?: { message: string; options: string[] } | null;
  expression?: string | null;
  navigated?: boolean;
  toolCalls: Array<{ tool: string; args: Record<string, unknown> }>;
  streamed?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
  errorType?: string;
  provider?: string;
  /** Legacy actions pass-through for managed mode */
  actions?: unknown[];
  extraRequests?: string[];
  autoContinue?: boolean;
}

// ─── Engine ───

export class QueryEngine {
  private history: ConversationHistory;
  private config: QueryEngineConfig;

  constructor(config: QueryEngineConfig) {
    this.config = config;
    this.history = new ConversationHistory({
      maxMessages: config.maxHistoryMessages ?? 50,
      maxEstimatedTokens: config.maxEstimatedTokens ?? 30_000,
    });
  }

  async query(input: QueryInput): Promise<QueryResult> {
    const caps = input.capabilities || {};
    const mode = input.manifestMode ? "manifest" : "no-manifest";

    const systemPrompt = this.config.systemPromptBuilder(
      mode,
      caps,
      this.config.yoloMode ?? false,
    );
    const userPrompt = this.config.userPromptBuilder({
      query: input.query,
      recipe: input.recipe,
      htmlSnapshot: input.htmlSnapshot,
      currentRoute: input.currentRoute,
      context: input.context,
      pageContext: input.pageContext,
    });

    const aiMessages = [
      ...this.history.toMessages(),
      { role: "user" as const, content: userPrompt },
    ];

    let result: QueryResult;

    if (this.config.provider.type === "legacy") {
      result = await this.withRetry(() =>
        this.queryLegacy(
          this.config.provider as LegacyProvider,
          systemPrompt,
          aiMessages,
        ),
      );
    } else {
      result = await this.withRetry(() =>
        this.queryBYOK(
          this.config.provider as BYOKProvider,
          systemPrompt,
          aiMessages,
        ),
      );
    }

    return this.postProcess(result);
  }

  private async queryLegacy(
    provider: LegacyProvider,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<QueryResult> {
    const jsonSchema = this.config.jsonSchema;
    if (!jsonSchema) {
      throw new Error("Legacy provider requires jsonSchema in config");
    }

    const legacyResult = (await provider.query(
      systemPrompt,
      messages,
      jsonSchema,
    )) as {
      actions: Array<{
        type: string;
        message?: string;
        options?: string[];
        target?: string;
        [key: string]: unknown;
      }>;
      extraRequests?: string[];
      autoContinue?: boolean;
    };

    // Convert legacy ActionResponse to QueryResult
    const resultMessages: string[] = [];
    let clarify: QueryResult["clarify"] = null;
    let navigated = false;
    const toolCalls: QueryResult["toolCalls"] = [];

    for (const action of legacyResult.actions) {
      if (action.type === "show-message" && action.message) {
        resultMessages.push(action.message);
      }
      if (action.type === "clarify" && action.message) {
        resultMessages.push(action.message);
        clarify = { message: action.message, options: action.options || [] };
      }
      if (action.type === "navigate") {
        navigated = true;
      }
      toolCalls.push({
        tool: action.type,
        args: action as unknown as Record<string, unknown>,
      });
    }

    return {
      messages: resultMessages,
      clarify,
      navigated,
      toolCalls,
      actions: legacyResult.actions,
      extraRequests: legacyResult.extraRequests,
      autoContinue: legacyResult.autoContinue,
    };
  }

  private async queryBYOK(
    provider: BYOKProvider,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
  ): Promise<QueryResult> {
    const tools = this.config.tools || {};

    const onStepFinish = (
      toolCalls: Array<{ toolName: string; input: Record<string, unknown> }>,
    ) => {
      for (const tc of toolCalls) {
        this.config.onStreamEvent?.({
          type: "tool_running",
          tool: tc.toolName,
          description: `Executing ${tc.toolName}...`,
        });
      }
      this.config.onStepFinish?.(toolCalls);
    };

    const result = await provider.query(
      systemPrompt,
      messages,
      tools,
      this.config.maxToolSteps ?? 10,
      onStepFinish,
    );

    this.config.onStreamEvent?.({
      type: "complete",
      finalText: result.text || "",
    });

    // The tool execution context (messages, clarify, expression, navigated)
    // is managed by the tools themselves via the ToolExecContext — results
    // are merged by the caller (handler)
    return {
      messages: [],
      toolCalls: result.toolCalls,
      streamed: true,
    };
  }

  /** Update history after a completed query */
  recordTurn(userQuery: string, result: QueryResult): void {
    const summary = ConversationHistory.buildAssistantSummary(
      result.toolCalls,
      result.messages,
    );
    this.history.appendTurn(userQuery, summary);
  }

  loadHistory(entries: HistoryEntry[]): void {
    this.history.load(
      entries.map((e) => ({
        role: e.role as "user" | "assistant",
        content: e.content,
      })),
    );
  }

  getHistory(): HistoryEntry[] {
    return this.history.getEntries();
  }

  reset(): void {
    this.history.clear();
  }

  updateConfig(partial: Partial<QueryEngineConfig>): void {
    Object.assign(this.config, partial);
  }

  private postProcess(result: QueryResult): QueryResult {
    // Rule: always include at least one show_message
    if (result.messages.length === 0 && !result.clarify && !result.error) {
      result.messages.push("Done.");
    }
    return result;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError: QueryError | null = null;

    while (attempt <= MAX_RETRIES) {
      try {
        return await fn();
      } catch (err) {
        const classified = this.classifyError(err);
        lastError = classified;

        if (!classified.retryable || attempt >= MAX_RETRIES) {
          this.config.onError?.(classified);
          throw err;
        }

        attempt++;
        const backoff = Math.min(
          1000 * Math.pow(2, attempt - 1) + Math.random() * 500,
          30_000,
        );
        this.config.onRetry?.(attempt, classified, backoff);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastError;
  }

  private classifyError(err: unknown): QueryError {
    if (!(err instanceof Error))
      return { type: "unknown", message: String(err), retryable: false };

    const msg = err.message.toLowerCase();
    const errRecord = err as unknown as Record<string, unknown>;
    const status = errRecord.status ?? errRecord.statusCode;
    const statusNum = typeof status === "number" ? status : undefined;

    // Resource exhaustion (BYOK out of credits)
    if (
      statusNum === 402 ||
      msg.includes("quota_exceeded") ||
      msg.includes("insufficient_quota") ||
      msg.includes("billing") ||
      msg.includes("exceeded your current quota")
    ) {
      return {
        type: "resource_exhausted",
        message: err.message,
        status: statusNum,
        retryable: false,
        provider: this.getProviderName(),
      };
    }

    // Rate limit (transient)
    if (statusNum === 429 && !msg.includes("quota")) {
      return {
        type: "api",
        message: err.message,
        status: statusNum,
        retryable: true,
      };
    }

    // Overloaded (transient)
    if (statusNum === 529 || statusNum === 503) {
      return {
        type: "api",
        message: err.message,
        status: statusNum,
        retryable: true,
      };
    }

    // Network errors (transient)
    if (
      msg.includes("econnreset") ||
      msg.includes("epipe") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return { type: "network", message: err.message, retryable: true };
    }

    // Permanent API errors
    if (statusNum === 400 || statusNum === 401 || statusNum === 403) {
      return {
        type: "api",
        message: err.message,
        status: statusNum,
        retryable: false,
      };
    }

    return { type: "unknown", message: err.message, retryable: false };
  }

  private getProviderName(): string {
    return "unknown";
  }
}
