import "server-only";
import type { AiProvider, AiSettings } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api";
import { SecretBoxError, open, seal } from "@/lib/crypto/secret-box";
import { log } from "@/lib/logger";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAiCompatibleProvider, PRESETS, normalizeBaseUrl } from "./providers/openai-compatible";
import { AiProviderError, type ChatProvider } from "./providers/types";

/** Providers each app mode may use. The web server must never call user-supplied URLs (SSRF), so it is Claude only. */
export function allowedProviders(mode: "web" | "desktop" = env.appMode): AiProvider[] {
  return mode === "desktop" ? ["ANTHROPIC", "OLLAMA", "LMSTUDIO", "OPENAI_COMPAT"] : ["ANTHROPIC"];
}

export const isLocalProvider = (p: AiProvider) => p !== "ANTHROPIC";

/** How much project context and output a provider gets. Local models have small context windows. */
export function limitsFor(provider: AiProvider) {
  return provider === "ANTHROPIC"
    ? { budgetChars: 60_000, maxFiles: 10, maxTokens: env.aiMaxOutputTokens }
    : { budgetChars: 20_000, maxFiles: 5, maxTokens: 8_000 };
}

export function looksLikeAnthropicKey(key: string) {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key);
}

/** What the browser may see: never the secrets themselves. */
export function publicSettings(s: AiSettings | null) {
  const provider = s?.provider ?? "ANTHROPIC";
  return {
    mode: env.appMode,
    allowed: allowedProviders(),
    provider: allowedProviders().includes(provider) ? provider : "ANTHROPIC",
    anthropic: { configured: !!s?.anthropicKeyEnc, last4: s?.anthropicKeyLast4 ?? null, model: env.anthropicModel },
    endpoint: { baseUrl: s?.baseUrl ?? null, model: s?.model ?? null, hasKey: !!s?.apiKeyEnc },
    publish: { url: s?.publishUrl ?? null, configured: !!s?.publishKeyEnc },
    presets: PRESETS,
  };
}

export async function getSettings(userId: string) {
  return prisma.aiSettings.findUnique({ where: { userId } });
}

function decrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return open(value);
  } catch (err) {
    if (err instanceof SecretBoxError) {
      log.warn("ai.settings.decrypt_failed", { reason: err.message });
      return null;
    }
    throw err;
  }
}

export interface UpdateInput {
  provider?: AiProvider;
  anthropicKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
  endpointKey?: string | null;
  publishUrl?: string | null;
  publishKey?: string | null;
}

/** Applies a settings change. `null` clears a value, `undefined` leaves it alone. */
export async function updateSettings(userId: string, input: UpdateInput) {
  const data: Partial<AiSettings> = {};
  const sealOrThrow = (v: string) => {
    try {
      return seal(v);
    } catch (err) {
      if (err instanceof SecretBoxError) throw new ApiError(503, "Saving keys is not configured on this server.", "encryption_unavailable");
      throw err;
    }
  };
  if (input.provider !== undefined) {
    if (!allowedProviders().includes(input.provider)) throw new ApiError(400, "That AI provider is only available in the desktop app.");
    data.provider = input.provider;
  }
  if (input.anthropicKey !== undefined) {
    if (input.anthropicKey === null) {
      data.anthropicKeyEnc = null;
      data.anthropicKeyLast4 = null;
    } else {
      const key = input.anthropicKey.trim();
      if (!looksLikeAnthropicKey(key)) throw new ApiError(400, "That doesn't look like an Anthropic API key (it starts with sk-ant-).");
      data.anthropicKeyEnc = sealOrThrow(key);
      data.anthropicKeyLast4 = key.slice(-4);
    }
  }
  const desktopOnly = (field: string) => {
    if (env.appMode !== "desktop") throw new ApiError(400, `${field} can only be set in the desktop app.`);
  };
  if (input.baseUrl !== undefined) {
    desktopOnly("A custom AI endpoint");
    try {
      data.baseUrl = input.baseUrl === null ? null : normalizeBaseUrl(input.baseUrl);
    } catch (err) {
      if (err instanceof AiProviderError) throw new ApiError(400, err.message);
      throw err;
    }
  }
  if (input.model !== undefined) {
    desktopOnly("A local model");
    data.model = input.model?.trim().slice(0, 200) || null;
  }
  if (input.endpointKey !== undefined) {
    desktopOnly("An endpoint key");
    data.apiKeyEnc = input.endpointKey ? sealOrThrow(input.endpointKey.trim()) : null;
  }
  if (input.publishUrl !== undefined) {
    desktopOnly("Publishing");
    try {
      data.publishUrl = input.publishUrl === null ? null : normalizeBaseUrl(input.publishUrl);
    } catch (err) {
      if (err instanceof AiProviderError) throw new ApiError(400, err.message);
      throw err;
    }
  }
  if (input.publishKey !== undefined) {
    desktopOnly("Publishing");
    if (input.publishKey && !/^(?:stardoom|aestro)_sk_[0-9A-Za-z]{40}$/.test(input.publishKey.trim())) {
      throw new ApiError(400, "That doesn't look like a Stardoom API key (it starts with stardoom_sk_).");
    }
    data.publishKeyEnc = input.publishKey ? sealOrThrow(input.publishKey.trim()) : null;
  }
  return prisma.aiSettings.upsert({ where: { userId }, create: { userId, ...data }, update: data });
}

/** The endpoint settings in plain form, for the "list models" helper. */
export function endpointOf(s: AiSettings | null, provider: AiProvider) {
  const preset = provider === "OLLAMA" || provider === "LMSTUDIO" ? PRESETS[provider].baseUrl : null;
  // A saved URL belongs to the provider it was saved with; switching provider falls back to its preset.
  const saved = s?.provider === provider ? s.baseUrl : null;
  return { baseUrl: saved || preset, apiKey: s?.provider === provider ? decrypt(s?.apiKeyEnc) : null };
}

/** The desktop app's stardoom.org publishing credentials. */
export function publishCredentials(s: AiSettings | null) {
  return { url: s?.publishUrl || "https://stardoom.org", key: decrypt(s?.publishKeyEnc) };
}

export interface ResolvedAi {
  provider: ChatProvider;
  kind: AiProvider;
  limits: ReturnType<typeof limitsFor>;
}

/** The provider an agent run uses for this user, or a user-facing error explaining what to set up. */
export async function resolveProvider(userId: string): Promise<ResolvedAi> {
  const s = await getSettings(userId);
  const kind = s && allowedProviders().includes(s.provider) ? s.provider : "ANTHROPIC";
  const limits = limitsFor(kind);
  if (kind === "ANTHROPIC") {
    const key = decrypt(s?.anthropicKeyEnc);
    if (!key) {
      throw new ApiError(402, "Add your Anthropic API key in Settings to use AI.", "ai_key_required");
    }
    return { kind, limits, provider: new AnthropicProvider(key, env.anthropicModel, env.anthropicEffort, limits.maxTokens) };
  }
  const { baseUrl, apiKey } = endpointOf(s, kind);
  if (!baseUrl) throw new ApiError(400, "Set the URL of your AI endpoint in Settings.", "ai_endpoint_required");
  if (!s?.model) throw new ApiError(400, "Choose a model for your local AI in Settings.", "ai_model_required");
  return { kind, limits, provider: new OpenAiCompatibleProvider(baseUrl, s.model, apiKey, limits.maxTokens) };
}

/** Whether AI runs can start, for page rendering (no network calls). */
export async function aiStatus(userId: string): Promise<{ ready: boolean; label: string }> {
  try {
    const r = await resolveProvider(userId);
    return { ready: true, label: r.kind === "ANTHROPIC" ? `Claude · ${r.provider.model}` : r.provider.model };
  } catch (err) {
    if (err instanceof ApiError) return { ready: false, label: err.message };
    throw err;
  }
}
