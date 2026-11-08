import { describe, expect, it, vi } from "vitest";
import { parseUnits } from "viem";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/pons/server", () => ({ publicClient: () => ({}) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
// Fixed market: 1 token = 1e-8 ETH, ETH = $2,000 → 1 token = $0.00002, so $1 = 50,000 tokens.
const PRICE = { quoteReserve: 10n ** 18n, tokenReserve: 10n ** 26n, ethUsdMicro: 2_000_000_000n };

import { KEY_PREFIX, generateKey, hashKey, looksLikeKey } from "@/lib/billing/keys";
import { tokensForUsd } from "@/lib/billing/price";

describe("API keys", () => {
  it("generates well-formed, unique keys and hashes them", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.key).toMatch(/^stardoom_sk_[0-9A-Za-z]{40}$/);
    expect(a.key).not.toBe(b.key);
    expect(looksLikeKey(a.key)).toBe(true);
    expect(a.hash).toBe(hashKey(a.key));
    expect(a.prefix).toBe(a.key.slice(0, KEY_PREFIX.length + 6));
  });

  it("rejects malformed keys", () => {
    expect(looksLikeKey("stardoom_sk_short")).toBe(false);
    expect(looksLikeKey("sk-ant-" + "a".repeat(40))).toBe(false);
    expect(looksLikeKey("stardoom_sk_" + "a".repeat(39) + "!")).toBe(false);
  });

  it("still accepts keys issued with the legacy aestro_sk_ prefix", () => {
    expect(looksLikeKey("aestro_sk_" + "a".repeat(40))).toBe(true);
    expect(looksLikeKey("aestro_sk_" + "a".repeat(39))).toBe(false);
  });
});

describe("$STARDOOM pricing", () => {
  it("converts dollars to tokens at the curve price", () => {
    expect(tokensForUsd(100, PRICE)).toBe(parseUnits("50000", 18));
    expect(tokensForUsd(250, PRICE)).toBe(parseUnits("125000", 18));
  });
});
