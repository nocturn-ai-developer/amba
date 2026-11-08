import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "crypto";

const db = vi.hoisted(() => ({ aiSettings: { findUnique: vi.fn(), upsert: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { SecretBoxError, open, parseKey, seal } from "@/lib/crypto/secret-box";
import { StreamAccumulator, normalizeBaseUrl, toOpenAiMessages } from "@/lib/ai/providers/openai-compatible";
import { AiProviderError } from "@/lib/ai/providers/types";
import { allowedProviders, endpointOf, resolveProvider, updateSettings } from "@/lib/ai/settings";
import { ApiError } from "@/lib/api";

const KEY = randomBytes(32).toString("base64");

describe("secret box", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const k = parseKey(KEY);
    const a = seal("sk-ant-secret", k);
    const b = seal("sk-ant-secret", k);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(open(a, k)).toBe("sk-ant-secret");
  });

  it("rejects tampered data and the wrong key", () => {
    const k = parseKey(KEY);
    const sealed = seal("hello", k);
    const raw = Buffer.from(sealed.slice(3), "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => open(`v1.${raw.toString("base64")}`, k)).toThrow(SecretBoxError);
    expect(() => open(sealed, parseKey(randomBytes(32).toString("base64")))).toThrow(SecretBoxError);
  });

  it("requires a 32-byte key", () => {
    expect(() => parseKey(undefined)).toThrow(SecretBoxError);
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(SecretBoxError);
  });
});

const sse = (...chunks: object[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";

describe("OpenAI-compatible stream", () => {
  it("collects text deltas and usage", () => {
    const texts: string[] = [];
    const acc = new StreamAccumulator({ onText: (d) => texts.push(d) });
    acc.write(sse({ choices: [{ delta: { content: "Hel" } }] }, { choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] }, { choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } }));
    acc.end();
    const r = acc.result();
    expect(texts).toEqual(["Hel", "lo"]);
    expect(r).toMatchObject({ text: "Hello", stop: "end", toolCalls: [], usage: { inputTokens: 12, outputTokens: 3 } });
  });

  it("joins tool calls split across chunks, even when a line is split across writes", () => {
    const started: string[] = [];
    const acc = new StreamAccumulator({ onToolStart: (_id, name) => started.push(name) });
    const stream = sse(
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "write_file", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":"src/App.tsx",' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"content":"x"}' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, id: "call_2", function: { name: "run_build", arguments: "{}" } }] }, finish_reason: "tool_calls" }] },
    );
    for (let i = 0; i < stream.length; i += 7) acc.write(stream.slice(i, i + 7));
    acc.end();
    const r = acc.result();
    expect(started).toEqual(["write_file", "run_build"]);
    expect(r.stop).toBe("tool_use");
    expect(r.toolCalls).toEqual([
      { id: "call_1", name: "write_file", input: { path: "src/App.tsx", content: "x" } },
      { id: "call_2", name: "run_build", input: {} },
    ]);
  });

  it("accepts whole tool calls in one chunk (Ollama style) and keeps invalid JSON as a string", () => {
    const acc = new StreamAccumulator();
    acc.write(sse({ choices: [{ delta: { tool_calls: [{ id: "a", function: { name: "read_file", arguments: '{"path":' } }] }, finish_reason: "tool_calls" }] }));
    acc.end();
    expect(acc.result().toolCalls).toEqual([{ id: "a", name: "read_file", input: '{"path":' }]);
  });

  it("maps finish_reason length to max_tokens and surfaces stream errors", () => {
    const acc = new StreamAccumulator();
    acc.write(sse({ choices: [{ delta: { content: "x" }, finish_reason: "length" }] }));
    expect(acc.result().stop).toBe("max_tokens");
    expect(() => new StreamAccumulator().write(`data: ${JSON.stringify({ error: { message: "model not found" } })}\n`)).toThrow(AiProviderError);
  });

  it("converts the neutral history to chat messages", () => {
    const out = toOpenAiMessages(["sys a", "sys b"], [
      { role: "user", content: "hi" },
      { role: "assistant", text: "", toolCalls: [{ id: "c1", name: "list_files", input: {} }] },
      { role: "tool", results: [{ id: "c1", name: "list_files", content: "boom", isError: true }] },
    ]);
    expect(out).toEqual([
      { role: "system", content: "sys a\n\nsys b" },
      { role: "user", content: "hi" },
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "list_files", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: "Error: boom" },
    ]);
  });

  it("normalizes endpoint URLs and rejects other schemes", () => {
    expect(normalizeBaseUrl(" http://127.0.0.1:11434/v1/ ")).toBe("http://127.0.0.1:11434/v1");
    expect(() => normalizeBaseUrl("file:///etc/passwd")).toThrow(AiProviderError);
    expect(() => normalizeBaseUrl("not a url")).toThrow(AiProviderError);
  });
});

describe("provider rules", () => {
  beforeEach(() => {
    vi.stubEnv("SECRET_ENCRYPTION_KEY", KEY);
    db.aiSettings.findUnique.mockReset();
    db.aiSettings.upsert.mockReset().mockImplementation(async ({ create }) => create);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("allows only Claude on the web, everything on desktop", () => {
    expect(allowedProviders("web")).toEqual(["ANTHROPIC"]);
    expect(allowedProviders("desktop")).toEqual(["ANTHROPIC", "OLLAMA", "LMSTUDIO", "OPENAI_COMPAT"]);
  });

  it("asks for a key when none is saved (402)", async () => {
    db.aiSettings.findUnique.mockResolvedValue(null);
    await expect(resolveProvider("u1")).rejects.toMatchObject({ status: 402, code: "ai_key_required" });
  });

  it("refuses local providers and endpoint URLs on the web (no SSRF)", async () => {
    await expect(updateSettings("u1", { provider: "OLLAMA" })).rejects.toBeInstanceOf(ApiError);
    await expect(updateSettings("u1", { baseUrl: "http://169.254.169.254/v1" })).rejects.toBeInstanceOf(ApiError);
    // A local provider saved earlier (e.g. by desktop) is ignored on the web: Claude is used instead.
    db.aiSettings.findUnique.mockResolvedValue({ provider: "OLLAMA", baseUrl: "http://127.0.0.1:11434/v1", model: "qwen", anthropicKeyEnc: null });
    await expect(resolveProvider("u1")).rejects.toMatchObject({ code: "ai_key_required" });
  });

  it("stores the Anthropic key encrypted with only the last 4 in clear", async () => {
    const key = "sk-ant-api03-" + "a".repeat(40) + "WXYZ";
    const saved = await updateSettings("u1", { anthropicKey: key });
    expect(saved.anthropicKeyLast4).toBe("WXYZ");
    expect(saved.anthropicKeyEnc).not.toContain(key);
    expect(open(saved.anthropicKeyEnc!, parseKey(KEY))).toBe(key);
    await expect(updateSettings("u1", { anthropicKey: "not-a-key" })).rejects.toMatchObject({ status: 400 });
  });

  it("resolves local providers on desktop and falls back to presets when switching", async () => {
    vi.stubEnv("STARDOOM_MODE", "desktop");
    db.aiSettings.findUnique.mockResolvedValue({ provider: "OLLAMA", baseUrl: null, model: "qwen2.5-coder:7b", apiKeyEnc: null });
    const r = await resolveProvider("u1");
    expect(r.kind).toBe("OLLAMA");
    expect(r.provider.model).toBe("qwen2.5-coder:7b");
    expect(r.limits.budgetChars).toBeLessThan(60_000);
    const s = { provider: "OLLAMA", baseUrl: "http://10.0.0.5:11434/v1", apiKeyEnc: null } as never;
    expect(endpointOf(s, "OLLAMA").baseUrl).toBe("http://10.0.0.5:11434/v1");
    expect(endpointOf(s, "LMSTUDIO").baseUrl).toBe("http://127.0.0.1:1234/v1");
  });
});
