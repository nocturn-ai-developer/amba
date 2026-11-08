import "server-only";
import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";

/**
 * Site-wide values edited by an admin at /admin and stored in the SiteSetting table.
 * Reads are cached briefly in process; a write through `saveTokenSettings` clears the cache.
 */

const KEYS = { tokenAddress: "token.address", tokenBuyUrl: "token.buyUrl" } as const;
const TTL_MS = 15_000;

export interface SiteToken {
  /** $STARDOOM contract address (checksummed), or null before launch. */
  address: string | null;
  /** Where people can buy it (https), optional. */
  buyUrl: string | null;
}

let cache: { at: number; value: SiteToken } | null = null;

/** Accepts an address in any case; returns it checksummed, or null when it is not a valid address. */
export function normalizeAddress(raw: string): string | null {
  const v = raw.trim();
  return /^0x[0-9a-fA-F]{40}$/.test(v) && isAddress(v, { strict: false }) ? getAddress(v) : null;
}

/** Only plain https links, so a stored value can never become a javascript: or data: URL on the page. */
export function normalizeBuyUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && v.length <= 500 ? u.toString() : null;
  } catch {
    return null;
  }
}

/** The $STARDOOM token as configured by an admin; falls back to CREDITS_TOKEN_ADDRESS when no admin value is saved. */
export async function siteToken(): Promise<SiteToken> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let rows: { key: string; value: string }[] = [];
  try {
    rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(KEYS) } } });
  } catch (err) {
    // A database hiccup must not take the landing page down; fall back to the environment.
    log.warn("site_settings.read_error", { error: errorMessage(err) });
  }
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? "";
  // A saved row wins, even an empty one (an admin cleared it); only with no row at all is the environment used.
  const stored = rows.find((r) => r.key === KEYS.tokenAddress);
  const value: SiteToken = {
    address: stored ? normalizeAddress(stored.value) : env.creditsToken ? normalizeAddress(env.creditsToken) : null,
    buyUrl: normalizeBuyUrl(get(KEYS.tokenBuyUrl)),
  };
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Saves the token settings. An empty address stores an explicit "none" (so the environment fallback
 * is not used either), which is how an admin hides a wrong address.
 */
export async function saveTokenSettings(input: { address: string | null; buyUrl: string | null }, userId: string) {
  const entries: [string, string][] = [
    [KEYS.tokenAddress, input.address ?? ""],
    [KEYS.tokenBuyUrl, input.buyUrl ?? ""],
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.siteSetting.upsert({ where: { key }, create: { key, value, updatedById: userId }, update: { value, updatedById: userId } }),
    ),
  );
  cache = null;
}

/** Just the checksummed $STARDOOM address, or null before launch (price, vote eligibility). */
export async function siteTokenAddress(): Promise<string | null> {
  return (await siteToken()).address;
}
