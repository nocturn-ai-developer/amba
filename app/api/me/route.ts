import { NextResponse } from "next/server";
import { requireUser, route } from "@/lib/api";
import { getSettings } from "@/lib/ai/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who the session or API key belongs to, and whether an AI key is set up. Handy for checking a key works. */
export const GET = route(async () => {
  const user = await requireUser();
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    aiConfigured: !!(await getSettings(user.id))?.anthropicKeyEnc,
    auth: user.apiKeyId ? "api_key" : "session",
  });
});
