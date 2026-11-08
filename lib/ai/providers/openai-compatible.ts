import { AiProviderError, ZERO_USAGE, type ChatMessage, type ChatProvider, type StopReason, type ToolCall, type TurnCallbacks, type TurnParams, type TurnResult, type Usage } from "./types";

/**
 * Any server that speaks the OpenAI Chat Completions API: Ollama, LM Studio, llama.cpp, vLLM, OpenRouter…
 * Only used by the desktop app, where the endpoint is on the user's own machine or chosen by them.
 */
export const PRESETS = {
  OLLAMA: { label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  LMSTUDIO: { label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
} as const;

export function normalizeBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new AiProviderError("bad_request", "The endpoint URL is not valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new AiProviderError("bad_request", "The endpoint must start with http:// or https://.");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

export function toOpenAiMessages(system: string[], messages: ChatMessage[]): WireMessage[] {
  const out: WireMessage[] = [];
  if (system.length) out.push({ role: "system", content: system.join("\n\n") });
  for (const m of messages) {
    if (m.role === "user") out.push({ role: "user", content: m.content });
    else if (m.role === "assistant") {
      out.push({
        role: "assistant",
        content: m.text || null,
        ...(m.toolCalls.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: "function" as const, function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) } })) }
          : {}),
      });
    } else {
      for (const r of m.results) out.push({ role: "tool", tool_call_id: r.id, content: r.isError ? `Error: ${r.content}` : r.content });
    }
  }
  return out;
}

interface Delta {
  content?: string | null;
  tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
}
interface Chunk {
  choices?: { delta?: Delta; message?: Delta; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } } | null;
  error?: { message?: string } | string;
}

/**
 * Folds a Chat Completions SSE stream into one turn. Pure, so it is unit-tested with recorded streams.
 * Handles tool calls split over many chunks (OpenAI, LM Studio) and sent whole in one chunk (Ollama).
 */
export class StreamAccumulator {
  private text = "";
  private calls = new Map<number, { id: string; name: string; args: string }>();
  private finish: string | null = null;
  private usage: Usage = { ...ZERO_USAGE };
  private buffer = "";
  done = false;

  constructor(private cb: TurnCallbacks = {}) {}

  /** Feed raw bytes-as-text; complete `data:` lines are processed, partial ones are kept. */
  write(text: string) {
    this.buffer += text;
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      this.line(line);
    }
  }

  end() {
    if (this.buffer.trim()) this.line(this.buffer.trim());
    this.buffer = "";
  }

  private line(line: string) {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (data === "[DONE]") {
      this.done = true;
      return;
    }
    let chunk: Chunk;
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    if (chunk.error) throw new AiProviderError("bad_request", typeof chunk.error === "string" ? chunk.error : chunk.error.message || "The model returned an error.");
    if (chunk.usage) {
      const cached = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      this.usage = { inputTokens: chunk.usage.prompt_tokens ?? 0, outputTokens: chunk.usage.completion_tokens ?? 0, cacheReadTokens: cached, cacheWriteTokens: 0 };
    }
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta ?? choice.message;
      if (delta?.content) {
        this.text += delta.content;
        this.cb.onText?.(delta.content);
      }
      for (const [i, tc] of (delta?.tool_calls ?? []).entries()) {
        const index = tc.index ?? i;
        let call = this.calls.get(index);
        if (!call) {
          call = { id: tc.id || `call_${index}_${Math.random().toString(36).slice(2, 10)}`, name: "", args: "" };
          this.calls.set(index, call);
        }
        if (tc.id) call.id = tc.id;
        if (tc.function?.name) {
          const first = !call.name;
          call.name += tc.function.name;
          if (first) this.cb.onToolStart?.(call.id, call.name);
        }
        if (tc.function?.arguments) call.args += tc.function.arguments;
      }
      if (choice.finish_reason) this.finish = choice.finish_reason;
    }
  }

  result(): TurnResult {
    const toolCalls: ToolCall[] = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .filter(([, c]) => c.name)
      .map(([, c]) => {
        let input: unknown = {};
        if (c.args.trim()) {
          try {
            input = JSON.parse(c.args);
          } catch {
            input = c.args; // fails tool validation and is reported back to the model
          }
        }
        return { id: c.id, name: c.name, input };
      });
    const stop: StopReason = this.finish === "length" ? "max_tokens" : toolCalls.length ? "tool_use" : "end";
    return { text: this.text.trim(), toolCalls, stop, usage: this.usage };
  }
}

export class OpenAiCompatibleProvider implements ChatProvider {
  private baseUrl: string;

  constructor(
    baseUrl: string,
    readonly model: string,
    private apiKey: string | null,
    private maxOutputTokens: number,
  ) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async turn(params: TurnParams, cb: TurnCallbacks = {}): Promise<TurnResult> {
    const body = {
      model: this.model,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: params.maxTokens ?? this.maxOutputTokens,
      messages: toOpenAiMessages(params.system, params.messages),
      ...(params.tools?.length
        ? {
            tools: params.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })),
            tool_choice: "auto",
          }
        : {}),
    };
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15 * 60 * 1000),
      });
    } catch {
      throw new AiProviderError("unavailable", `Could not reach ${this.baseUrl}. Is your local AI server running?`);
    }
    if (!res.ok || !res.body) throw await httpError(res, this.model);

    const acc = new StreamAccumulator(cb);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      acc.write(decoder.decode(value, { stream: true }));
    }
    acc.end();
    return acc.result();
  }
}

async function httpError(res: Response, model: string) {
  const text = (await res.text().catch(() => "")).slice(0, 500);
  if (res.status === 401 || res.status === 403) return new AiProviderError("auth", "The AI endpoint rejected the API key.");
  if (res.status === 404) return new AiProviderError("bad_request", `Model "${model}" was not found on the endpoint. Pick another one in Settings.`);
  if (res.status === 429) return new AiProviderError("rate_limit", "The AI endpoint is rate-limited. Try again in a moment.");
  if (/tool|function/i.test(text)) return new AiProviderError("bad_request", `Model "${model}" does not support tool calling. Choose a model that does (e.g. qwen2.5-coder, qwen3, llama3.1).`);
  return new AiProviderError("unavailable", `The AI endpoint returned HTTP ${res.status}.`);
}

/** Model ids served by the endpoint (GET /models). */
export async function listModels(baseUrl: string, apiKey: string | null): Promise<string[]> {
  const url = normalizeBaseUrl(baseUrl);
  let res: Response;
  try {
    res = await fetch(`${url}/models`, { headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {}, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AiProviderError("unavailable", `Could not reach ${url}. Is your local AI server running?`);
  }
  if (!res.ok) throw await httpError(res, "");
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] };
  return (data.data ?? []).map((m) => m.id).filter((id): id is string => !!id).sort();
}
