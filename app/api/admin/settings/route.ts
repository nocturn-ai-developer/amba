import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Address } from "viem";
import { ApiError, parseJson, requireAdmin, route } from "@/lib/api";
import { log, errorMessage } from "@/lib/logger";
import { normalizeAddress, normalizeBuyUrl, saveTokenSettings, siteToken } from "@/lib/site-settings";
import { publicClient } from "@/lib/pons/server";
import { ponsDeployment } from "@/lib/pons/config";
import { readLaunchedToken } from "@/lib/pons/factory";

export const dynamic = "force-dynamic";

const Body = z.object({
  tokenAddress: z.string().max(100),
  buyUrl: z.string().max(500),
});

/** Current site settings (admin only). */
export const GET = route(async () => {
  await requireAdmin();
  return NextResponse.json({ token: await siteToken() });
});

/**
 * Saves the $STARDOOM contract address and buy link. The address is checked on Robinhood Chain on a
 * best-effort basis: problems come back as warnings (the chain may be unreachable), never as a block.
 */
export const PUT = route(async (req) => {
  const user = await requireAdmin();
  const body = await parseJson(req, Body);

  const rawAddress = body.tokenAddress.trim();
  const address = rawAddress ? normalizeAddress(rawAddress) : null;
  if (rawAddress && !address) throw new ApiError(400, "That is not a valid contract address (0x followed by 40 hex characters).", "bad_address");
  const rawUrl = body.buyUrl.trim();
  const buyUrl = rawUrl ? normalizeBuyUrl(rawUrl) : null;
  if (rawUrl && !buyUrl) throw new ApiError(400, "The buy link must be a full https:// URL.", "bad_url");

  const warnings: string[] = [];
  if (address) {
    try {
      const client = publicClient();
      const code = await client.getCode({ address: address as Address });
      if (!code || code === "0x") {
        warnings.push("No contract found at this address on Robinhood Chain. Double-check it.");
      } else {
        const launched = await readLaunchedToken(client, ponsDeployment().factory, address as Address);
        if (!launched.exists) warnings.push("This contract is not a Pons V2 launch, so the live price (Battleground voting) will not work.");
      }
    } catch (err) {
      log.warn("admin.settings.chain_check_failed", { error: errorMessage(err) });
      warnings.push("Could not reach Robinhood Chain to check the address. It was saved anyway.");
    }
  }

  await saveTokenSettings({ address, buyUrl }, user.id);
  log.info("admin.settings.token_saved", { userId: user.id, address, buyUrl });
  revalidatePath("/");
  return NextResponse.json({ token: await siteToken(), warnings });
});
