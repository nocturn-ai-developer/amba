/**
 * Provider-neutral chat types. The agent loop speaks only these; each provider converts to and from
 * its own wire format (Anthropic Messages API, OpenAI-compatible Chat Completions).
 */

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Parsed JSON arguments, or the raw string when the model produced invalid JSON (rejected by tool validation). */
  input: unknown;
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type ChatMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      text: string;
      toolCalls: ToolCall[];
      /** Provider-native content to replay verbatim (keeps Anthropic thinking blocks valid across tool turns). */
      native?: unknown;
    }
  | { role: "tool"; results: ToolResult[] };

export interface Usage {
  /** All input tokens, including cache reads and writes. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

export type StopReason = "end" | "tool_use" | "max_tokens" | "pause";

export interface TurnResult {
  text: string;
  toolCalls: ToolCall[];
  stop: StopReason;
  usage: Usage;
  native?: unknown;
}

export interface TurnParams {
  system: string[];
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

export interface TurnCallbacks {
  onText?: (delta: string) => void;
  onToolStart?: (id: string, name: string) => void;
}

export interface ChatProvider {
  /** Shown in logs and usage records. */
  readonly model: string;
  turn(params: TurnParams, cb?: TurnCallbacks): Promise<TurnResult>;
}

export type AiErrorKind = "auth" | "rate_limit" | "unavailable" | "refusal" | "bad_request";

/** A provider failure with a message that is safe to show to the user. */
export class AiProviderError extends Error {
  constructor(
    public kind: AiErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
