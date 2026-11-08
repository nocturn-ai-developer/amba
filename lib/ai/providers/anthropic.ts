import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTextBlockParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AiProviderError, type ChatMessage, type ChatProvider, type StopReason, type TurnCallbacks, type TurnParams, type TurnResult } from "./types";

/**
 * Claude through the user's own API key. A client is created per run, so one user's key can never be
 * used for another user's request, and the key never reaches the browser or project sandboxes.
 */
export class AnthropicProvider implements ChatProvider {
  private client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    private defaultEffort: "low" | "medium" | "high" | "xhigh" | "max",
    private maxOutputTokens: number,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 10 * 60 * 1000 });
  }

  async turn(params: TurnParams, cb: TurnCallbacks = {}): Promise<TurnResult> {
    const system: BetaTextBlockParam[] = params.system.map((text, i, all) =>
      i === all.length - 1 ? { type: "text", text, cache_control: { type: "ephemeral" } } : { type: "text", text },
    );
    const tools: BetaTool[] | undefined = params.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as BetaTool["input_schema"],
      // Large file bodies stream as they are generated; inputs are validated before use.
      ...(t.name === "write_file" || t.name === "edit_file" ? { eager_input_streaming: true } : {}),
    }));
    let message: BetaMessage;
    try {
      const stream = this.client.beta.messages.stream({
        model: this.model,
        max_tokens: params.maxTokens ?? this.maxOutputTokens,
        system,
        messages: toAnthropic(params.messages),
        tools,
        tool_choice: tools?.length ? { type: "auto" } : undefined,
        thinking: { type: "adaptive" },
        output_config: { effort: params.effort ?? this.defaultEffort },
        // Cache the stable prefix (system + tools) and the growing tool-loop history.
        cache_control: { type: "ephemeral" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      stream.on("text", (delta) => cb.onText?.(delta));
      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          cb.onToolStart?.(event.content_block.id, event.content_block.name);
        }
      });
      message = await stream.finalMessage();
    } catch (err) {
      throw mapAnthropicError(err);
    }
    if (message.stop_reason === "refusal") throw new AiProviderError("refusal", "Claude declined this request.");

    const u = message.usage;
    const toolCalls = message.content
      .filter((b): b is BetaToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: b.input }));
    const stop: StopReason =
      message.stop_reason === "pause_turn" ? "pause" : message.stop_reason === "max_tokens" ? "max_tokens" : toolCalls.length ? "tool_use" : "end";
    return {
      text: message.content
        .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim(),
      toolCalls,
      stop,
      usage: {
        inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        outputTokens: u.output_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      },
      native: message.content,
    };
  }
}

function toAnthropic(messages: ChatMessage[]): BetaMessageParam[] {
  return messages.map((m): BetaMessageParam => {
    if (m.role === "user") return { role: "user", content: m.content };
    if (m.role === "tool") {
      return {
        role: "user",
        content: m.results.map((r): BetaToolResultBlockParam => ({ type: "tool_result", tool_use_id: r.id, content: r.content, is_error: r.isError || undefined })),
      };
    }
    if (m.native) return { role: "assistant", content: m.native as BetaContentBlockParam[] };
    const content: BetaContentBlockParam[] = [];
    if (m.text) content.push({ type: "text", text: m.text });
    for (const c of m.toolCalls) content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input as Record<string, unknown> });
    return { role: "assistant", content };
  });
}

function mapAnthropicError(err: unknown): unknown {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError("auth", "Your Anthropic API key was rejected. Check it in Settings.");
  }
  if (err instanceof Anthropic.RateLimitError) return new AiProviderError("rate_limit", "Your Anthropic account is rate-limited right now. Try again in a moment.");
  if (err instanceof Anthropic.APIConnectionError) return new AiProviderError("unavailable", "Could not reach the Anthropic API.");
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    return new AiProviderError("bad_request", "Your Anthropic account has no credit left. Add billing in the Anthropic console.");
  }
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) return new AiProviderError("unavailable", "Claude is having trouble right now. Try again shortly.");
  return err;
}

/** Validates a key with a cheap authenticated call. */
export async function testAnthropicKey(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await new Anthropic({ apiKey, maxRetries: 0, timeout: 15_000 }).models.list({ limit: 1 });
    return { ok: true };
  } catch (err) {
    const mapped = mapAnthropicError(err);
    if (mapped instanceof AiProviderError && mapped.kind === "auth") return { ok: false, message: "Anthropic rejected this key. Copy it again from the Anthropic console." };
    return { ok: false, message: mapped instanceof AiProviderError ? mapped.message : "Could not verify the key." };
  }
}
