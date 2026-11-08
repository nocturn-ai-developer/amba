import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({ rows: [] as { key: string; value: string }[], fail: false }));
vi.mock("@/lib/db", () => ({
  prisma: {
    siteSetting: {
      findMany: vi.fn(async () => {
        if (db.fail) throw new Error("db down");
        return db.rows;
      }),
      upsert: vi.fn(async ({ create }: { create: { key: string; value: string } }) => {
        db.rows = [...db.rows.filter((r) => r.key !== create.key), { key: create.key, value: create.value }];
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { normalizeAddress, normalizeBuyUrl, saveTokenSettings, siteToken } from "@/lib/site-settings";

const LOWER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const ENV_TOKEN = "0x1111111111111111111111111111111111111111";

describe("site settings: $STARDOOM token", () => {
  beforeEach(async () => {
    db.rows = [];
    db.fail = false;
    // Clear the in-process cache through the public API (a save resets it), then drop the rows again.
    await saveTokenSettings({ address: null, buyUrl: null }, "u1");
    db.rows = [];
  });
  afterEach(() => vi.unstubAllEnvs());

  it("normalises addresses to checksum case and rejects junk", () => {
    expect(normalizeAddress(` ${LOWER} `)).toBe("0xABcdEFABcdEFabcdEfAbCdefabcdeFABcDEFabCD");
    expect(normalizeAddress("0x123")).toBeNull();
    expect(normalizeAddress("abcdefabcdefabcdefabcdefabcdefabcdefabcd")).toBeNull();
    expect(normalizeAddress("0xZZcdefabcdefabcdefabcdefabcdefabcdefabcd")).toBeNull();
  });

  it("only accepts https buy links", () => {
    expect(normalizeBuyUrl("https://pons.family/token/x")).toBe("https://pons.family/token/x");
    expect(normalizeBuyUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeBuyUrl("http://example.com")).toBeNull();
    expect(normalizeBuyUrl("data:text/html,hi")).toBeNull();
    expect(normalizeBuyUrl("")).toBeNull();
  });

  it("falls back to CREDITS_TOKEN_ADDRESS only when no admin value was ever saved", async () => {
    vi.stubEnv("CREDITS_TOKEN_ADDRESS", ENV_TOKEN);
    expect((await siteToken()).address).toBe(ENV_TOKEN);
  });

  it("an admin value wins over the environment, and an explicit empty value hides it", async () => {
    vi.stubEnv("CREDITS_TOKEN_ADDRESS", ENV_TOKEN);
    await saveTokenSettings({ address: normalizeAddress(LOWER), buyUrl: "https://example.com/buy" }, "u1");
    expect(await siteToken()).toEqual({ address: normalizeAddress(LOWER), buyUrl: "https://example.com/buy" });
    await saveTokenSettings({ address: null, buyUrl: null }, "u1");
    expect(await siteToken()).toEqual({ address: null, buyUrl: null });
  });

  it("keeps the page up when the database read fails", async () => {
    db.fail = true;
    await expect(siteToken()).resolves.toEqual({ address: null, buyUrl: null });
  });
});
