"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Cpu, KeyRound, RefreshCw, Send, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Provider = "ANTHROPIC" | "OLLAMA" | "LMSTUDIO" | "OPENAI_COMPAT";

export interface AiSettingsView {
  mode: "web" | "desktop";
  allowed: Provider[];
  provider: Provider;
  anthropic: { configured: boolean; last4: string | null; model: string };
  endpoint: { baseUrl: string | null; model: string | null; hasKey: boolean };
  publish: { url: string | null; configured: boolean };
  presets: Record<"OLLAMA" | "LMSTUDIO", { label: string; baseUrl: string }>;
}

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: "ANTHROPIC", label: "Claude", hint: "Your Anthropic API key" },
  { id: "OLLAMA", label: "Ollama", hint: "Local, free" },
  { id: "LMSTUDIO", label: "LM Studio", hint: "Local, free" },
  { id: "OPENAI_COMPAT", label: "Custom", hint: "Any OpenAI-compatible URL" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as T;
}

type Status = { ok: boolean; message: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p className={cn("mt-3 flex items-start gap-2 text-[13px]", status.ok ? "text-success" : "text-danger")} role="status">
      {status.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
      {status.message}
    </p>
  );
}

export function AiSettings({ initial }: { initial: AiSettingsView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const desktop = view.mode === "desktop";

  async function save(body: Record<string, unknown>) {
    const next = await api<AiSettingsView>("/api/ai-settings", { method: "PUT", body: JSON.stringify(body) });
    setView(next);
    router.refresh();
    return next;
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">
        <Sparkles className="size-3.5" /> AI provider
      </div>
      <p className="mt-2 text-[13.5px] text-muted">
        {desktop
          ? "Choose which AI builds your apps: Claude with your own Anthropic key, or a model running on this computer."
          : "Stardoom runs the AI with your own Anthropic API key, billed by Anthropic at their prices. Stardoom never charges for AI. Your key is encrypted and never shown again."}
      </p>

      {view.allowed.length > 1 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="AI provider">
          {PROVIDERS.filter((p) => view.allowed.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={provider === p.id}
              onClick={() => setProvider(p.id)}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-left transition-colors",
                provider === p.id ? "border-fg bg-elevated" : "border-border hover:border-fg/40",
              )}
            >
              <div className="text-[13.5px] font-semibold">{p.label}</div>
              <div className="text-[11.5px] text-subtle">{p.hint}</div>
              {view.provider === p.id && <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-wider text-success">In use</div>}
            </button>
          ))}
        </div>
      )}

      {provider === "ANTHROPIC" ? (
        <AnthropicForm view={view} onSave={save} desktop={desktop} />
      ) : (
        <EndpointForm key={provider} provider={provider} view={view} onSave={save} />
      )}

      {desktop && <PublishForm view={view} onSave={save} />}
    </section>
  );
}

function AnthropicForm({ view, onSave, desktop }: { view: AiSettingsView; onSave: (b: Record<string, unknown>) => Promise<AiSettingsView>; desktop: boolean }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "remove" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  async function run(kind: "save" | "test" | "remove") {
    setBusy(kind);
    setStatus(null);
    try {
      if (kind === "test") {
        const res = await api<{ ok: boolean; message: string }>("/api/ai-settings/test", { method: "POST", body: JSON.stringify({ provider: "ANTHROPIC", ...(key.trim() ? { anthropicKey: key.trim() } : {}) }) });
        setStatus(res);
      } else if (kind === "save") {
        const test = await api<{ ok: boolean; message: string }>("/api/ai-settings/test", { method: "POST", body: JSON.stringify({ provider: "ANTHROPIC", anthropicKey: key.trim() }) });
        if (!test.ok) return setStatus(test);
        await onSave({ anthropicKey: key.trim(), provider: "ANTHROPIC" });
        setKey("");
        setStatus({ ok: true, message: "Key saved. You're ready to build." });
      } else {
        await onSave({ anthropicKey: null });
        setStatus({ ok: true, message: "Key removed." });
      }
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  const inUse = view.provider === "ANTHROPIC";
  return (
    <div className="mt-5">
      {view.anthropic.configured ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border px-4 py-3">
          <KeyRound className="size-4 text-subtle" />
          <code className="font-mono text-[13px]">sk-ant-…{view.anthropic.last4}</code>
          <span className="text-[12.5px] text-subtle">Model: {view.anthropic.model}</span>
          <div className="ml-auto flex gap-2">
            {desktop && !inUse && (
              <Button size="sm" onClick={() => onSave({ provider: "ANTHROPIC" }).then(() => setStatus({ ok: true, message: "Claude is now your AI provider." }))}>
                Use Claude
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => run("test")} loading={busy === "test"}>
              Test
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run("remove")} loading={busy === "remove"}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-subtle">
          No key yet. Create one at{" "}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
            console.anthropic.com
          </a>
          .
        </p>
      )}
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) run("save");
        }}
      >
        <Label htmlFor="anthropic-key" className="sr-only">
          Anthropic API key
        </Label>
        <Input
          id="anthropic-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={view.anthropic.configured ? "Paste a new key to replace it" : "sk-ant-…"}
          className="h-9 min-w-[240px] flex-1 font-mono"
        />
        <Button type="submit" disabled={!key.trim()} loading={busy === "save"}>
          {view.anthropic.configured ? "Replace key" : "Save key"}
        </Button>
      </form>
      <StatusLine status={status} />
    </div>
  );
}

function EndpointForm({ provider, view, onSave }: { provider: Exclude<Provider, "ANTHROPIC">; view: AiSettingsView; onSave: (b: Record<string, unknown>) => Promise<AiSettingsView> }) {
  const preset = provider === "OPENAI_COMPAT" ? null : view.presets[provider];
  const sameProvider = view.provider === provider;
  const [baseUrl, setBaseUrl] = useState((sameProvider && view.endpoint.baseUrl) || preset?.baseUrl || "");
  const [model, setModel] = useState((sameProvider && view.endpoint.model) || "");
  const [endpointKey, setEndpointKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<"models" | "save" | "test" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  async function loadModels() {
    setBusy("models");
    setStatus(null);
    try {
      // The model list reads the saved endpoint, so store the URL (and key) first.
      await onSave({ provider, baseUrl, ...(endpointKey ? { endpointKey } : {}) });
      const res = await api<{ models: string[] }>(`/api/ai-settings/models?provider=${provider}`);
      setModels(res.models);
      if (!res.models.length) setStatus({ ok: false, message: "No models found. Download one first, e.g. `ollama pull qwen2.5-coder:7b`." });
      else if (!model) setModel(res.models[0]);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (sameProvider) loadModels().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAndTest() {
    setBusy("save");
    setStatus(null);
    try {
      await onSave({ provider, baseUrl, model, ...(endpointKey ? { endpointKey } : {}) });
      const res = await api<{ ok: boolean; message: string }>("/api/ai-settings/test", { method: "POST", body: JSON.stringify({ provider }) });
      setStatus(res);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 space-y-3">
      <div>
        <Label htmlFor="endpoint-url">Endpoint URL</Label>
        <Input id="endpoint-url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:11434/v1" className="mt-1 h-9 font-mono" spellCheck={false} />
      </div>
      {provider === "OPENAI_COMPAT" && (
        <div>
          <Label htmlFor="endpoint-key">API key (optional)</Label>
          <Input
            id="endpoint-key"
            type="password"
            autoComplete="off"
            value={endpointKey}
            onChange={(e) => setEndpointKey(e.target.value)}
            placeholder={view.endpoint.hasKey && sameProvider ? "Saved. Paste a new one to replace it" : "Only if your server needs one"}
            className="mt-1 h-9 font-mono"
          />
        </div>
      )}
      <div>
        <Label htmlFor="endpoint-model">Model</Label>
        <div className="mt-1 flex gap-2">
          {models.length ? (
            <select
              id="endpoint-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-inset px-3 font-mono text-sm text-fg"
            >
              {!models.includes(model) && model && <option value={model}>{model}</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input id="endpoint-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="qwen2.5-coder:7b" className="h-9 flex-1 font-mono" spellCheck={false} />
          )}
          <Button type="button" variant="secondary" size="sm" className="h-9" onClick={loadModels} loading={busy === "models"} disabled={!baseUrl.trim()}>
            <RefreshCw /> Load models
          </Button>
        </div>
      </div>
      <p className="flex items-start gap-2 text-[12.5px] text-subtle">
        <Cpu className="mt-0.5 size-3.5 shrink-0" />
        The model must support tool calling (for example qwen2.5-coder, qwen3 or llama3.1). Small models make more mistakes; 14B+ works best.
        {provider === "OLLAMA" && " Give Ollama a larger context window (OLLAMA_CONTEXT_LENGTH=32768) for better results."}
      </p>
      <Button onClick={saveAndTest} disabled={!baseUrl.trim() || !model.trim()} loading={busy === "save"}>
        {view.provider === provider ? "Save & test" : `Use ${PROVIDERS.find((p) => p.id === provider)?.label}`}
      </Button>
      <StatusLine status={status} />
    </div>
  );
}

function PublishForm({ view, onSave }: { view: AiSettingsView; onSave: (b: Record<string, unknown>) => Promise<AiSettingsView> }) {
  const [url, setUrl] = useState(view.publish.url ?? "https://stardoom.org");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit() {
    setBusy(true);
    setStatus(null);
    try {
      await onSave({ publishUrl: url, ...(key.trim() ? { publishKey: key.trim() } : {}) });
      setKey("");
      setStatus({ ok: true, message: "Saved. Use Publish in the builder to put a project online." });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border-t border-border pt-6">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">
        <Send className="size-3.5" /> Publish to the web
      </div>
      <p className="mt-2 text-[13.5px] text-muted">
        Connect your Stardoom account to deploy projects to their own subdomain and launch tokens. Create a key on stardoom.org under Account → API keys.
      </p>
      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <Label htmlFor="publish-url">Server</Label>
          <Input id="publish-url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1 h-9 font-mono" spellCheck={false} />
        </div>
        <div>
          <Label htmlFor="publish-key">Stardoom API key</Label>
          <Input
            id="publish-key"
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={view.publish.configured ? "Saved. Paste a new one to replace it" : "stardoom_sk_…"}
            className="mt-1 h-9 font-mono"
          />
        </div>
        <Button type="submit" variant="secondary" loading={busy}>
          Save account
        </Button>
      </form>
      <StatusLine status={status} />
    </div>
  );
}
