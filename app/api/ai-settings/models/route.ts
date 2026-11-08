import { NextResponse } from "next/server";
import { ApiError, requireSessionUser, route } from "@/lib/api";
import { allowedProviders, endpointOf, getSettings } from "@/lib/ai/settings";
import { listModels } from "@/lib/ai/providers/openai-compatible";
import { AiProviderError } from "@/lib/ai/providers/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ai-settings/models?provider=OLLAMA — models served by the saved (or preset) local endpoint. Desktop only. */
export const GET = route(async (req) => {
  const user = await requireSessionUser();
  const provider = new URL(req.url).searchParams.get("provider");
  if (provider !== "OLLAMA" && provider !== "LMSTUDIO" && provider !== "OPENAI_COMPAT") throw new ApiError(400, "Unknown provider.");
  if (!allowedProviders().includes(provider)) throw new ApiError(400, "Local AI is only available in the desktop app.");
  const { baseUrl, apiKey } = endpointOf(await getSettings(user.id), provider);
  if (!baseUrl) throw new ApiError(400, "Set the endpoint URL first.");
  try {
    return NextResponse.json({ models: await listModels(baseUrl, apiKey) });
  } catch (err) {
    if (err instanceof AiProviderError) throw new ApiError(502, err.message);
    throw err;
  }
});
