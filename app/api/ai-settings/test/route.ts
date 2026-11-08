import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, enforceRateLimit, parseJson, requireSessionUser, route } from "@/lib/api";
import { env } from "@/lib/env";
import { LIMITS } from "@/lib/rate-limit";
import { allowedProviders, endpointOf, getSettings, resolveProvider } from "@/lib/ai/settings";
import { testAnthropicKey } from "@/lib/ai/providers/anthropic";
import { listModels } from "@/lib/ai/providers/openai-compatible";
import { AiProviderError } from "@/lib/ai/providers/types";
import { open } from "@/lib/crypto/secret-box";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["ANTHROPIC", "OLLAMA", "LMSTUDIO", "OPENAI_COMPAT"]),
  /** Test this key instead of the saved one (before saving). */
  anthropicKey: z.string().trim().max(400).optional(),
});

/**
 * Checks that the chosen provider works: the Anthropic key authenticates, or the local endpoint answers
 * and serves the selected model. Never returns or logs the key.
 */
export const POST = route(async (req) => {
  const user = await requireSessionUser();
  await enforceRateLimit(`ai-test:${user.id}`, LIMITS.apiKeys);
  const { provider, anthropicKey } = await parseJson(req, schema);
  if (!allowedProviders().includes(provider)) throw new ApiError(400, "That AI provider is only available in the desktop app.");
  const s = await getSettings(user.id);

  if (provider === "ANTHROPIC") {
    let key = anthropicKey;
    if (!key && s?.anthropicKeyEnc) {
      try {
        key = open(s.anthropicKeyEnc);
      } catch {
        throw new ApiError(400, "Your saved key can't be read anymore. Paste it again.");
      }
    }
    if (!key) throw new ApiError(400, "Paste your Anthropic API key first.");
    const res = await testAnthropicKey(key);
    return NextResponse.json(res.ok ? { ok: true, message: `Key works. Runs use ${env.anthropicModel}.` } : { ok: false, message: res.message });
  }

  const { baseUrl, apiKey } = endpointOf(s, provider);
  if (!baseUrl) throw new ApiError(400, "Set the endpoint URL first.");
  try {
    const models = await listModels(baseUrl, apiKey);
    if (!models.length) return NextResponse.json({ ok: false, message: "The endpoint answered but serves no models. Download one first (e.g. `ollama pull qwen2.5-coder:7b`)." });
    if (s?.model && !models.includes(s.model)) return NextResponse.json({ ok: false, message: `Model "${s.model}" isn't available there. Pick one from the list.` });
    if (s?.model && s.provider === provider) await resolveProvider(user.id);
    return NextResponse.json({ ok: true, message: s?.model ? `Connected. Using ${s.model}.` : `Connected. Pick one of ${models.length} model(s).` });
  } catch (err) {
    if (err instanceof AiProviderError) return NextResponse.json({ ok: false, message: err.message });
    throw err;
  }
});
