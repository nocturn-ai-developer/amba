import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, parseJson, requireSessionUser, route } from "@/lib/api";
import { LIMITS } from "@/lib/rate-limit";
import { getSettings, publicSettings, updateSettings } from "@/lib/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The user's AI provider settings, without any secret values. Browser session only (not API keys). */
export const GET = route(async () => {
  const user = await requireSessionUser();
  return NextResponse.json(publicSettings(await getSettings(user.id)));
});

const optionalString = (max: number) => z.string().trim().max(max).nullable().optional();
const schema = z.object({
  provider: z.enum(["ANTHROPIC", "OLLAMA", "LMSTUDIO", "OPENAI_COMPAT"]).optional(),
  anthropicKey: optionalString(400),
  baseUrl: optionalString(500),
  model: optionalString(200),
  endpointKey: optionalString(400),
  publishUrl: optionalString(500),
  publishKey: optionalString(200),
});

/** Partial update: a field set to null is cleared, a missing field is left as it is. */
export const PUT = route(async (req) => {
  const user = await requireSessionUser();
  await enforceRateLimit(`ai-settings:${user.id}`, LIMITS.apiKeys);
  const body = await parseJson(req, schema);
  // An empty string means "clear" for convenience in forms.
  const clean = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === "" ? null : v]));
  const saved = await updateSettings(user.id, clean);
  return NextResponse.json(publicSettings(saved));
});

/** Removes every stored key and resets the provider. */
export const DELETE = route(async () => {
  const user = await requireSessionUser();
  const saved = await updateSettings(user.id, { provider: "ANTHROPIC", anthropicKey: null });
  return NextResponse.json(publicSettings(saved));
});
