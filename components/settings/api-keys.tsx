"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Key {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}


async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong."), { code: data.code as string | undefined });
  return data as T;
}

export function ApiKeys({ initialKeys }: { initialKeys: Key[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ key: string; apiKey: Key }>("/api/keys", { method: "POST", body: JSON.stringify({ name: name.trim() || "Default" }) });
      setKeys((k) => [data.apiKey, ...k]);
      setCreated(data.key);
      setCopied(false);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await api(`/api/keys/${id}`, { method: "DELETE" });
      setKeys((k) => k.filter((x) => x.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      // Clipboard blocked: the key is still selectable.
    }
  }

  return (
    <section className="panel rounded-3xl p-6">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">API keys</div>
      <p className="mt-2 text-[13.5px] text-muted">Use a key to create apps, run the AI and deploy from your own scripts and tools, or to publish from the Stardoom desktop app. Runs use the Anthropic key saved above.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. My bot" maxLength={60} className="h-9 min-w-[220px] flex-1" />
        <Button onClick={create} loading={busy}>
          <KeyRound /> Create key
        </Button>
      </div>

      {created && (
        <div className="mt-4 rounded-2xl border border-fg/30 bg-elevated p-4">
          <div className="text-[12.5px] font-semibold">Copy your key now. You won&apos;t be able to see it again.</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-md bg-bg px-3 py-2 font-mono text-[12.5px]">{created}</code>
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      {keys.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[13.5px]">
              <span className="font-semibold">{k.name}</span>
              <code className="font-mono text-[12.5px] text-subtle">{k.prefix}…</code>
              <span className="text-[12.5px] text-subtle">{k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => revoke(k.id)}>
                <Trash2 /> Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ApiDocs() {
  const [origin, setOrigin] = useState("https://stardoom.org");
  useEffect(() => setOrigin(window.location.origin), []);
  const h = `-H "Authorization: Bearer $STARDOOM_KEY"`;
  const snippets: [string, string][] = [
    ["Check your key", `curl ${origin}/api/me ${h}`],
    ["Create an app from a prompt", `curl -X POST ${origin}/api/projects ${h} \\\n  -H "content-type: application/json" \\\n  -d '{"prompt":"A landing page for my coffee shop"}'`],
    ["Let the AI build it (streams progress as NDJSON)", `curl -N -X POST ${origin}/api/projects/PROJECT_ID/ai ${h} \\\n  -H "content-type: application/json" -d '{"initial":true}'`],
    ["Ask for a change", `curl -N -X POST ${origin}/api/projects/PROJECT_ID/ai ${h} \\\n  -H "content-type: application/json" -d '{"prompt":"Make the header dark"}'`],
    ["Deploy it", `curl -X POST ${origin}/api/projects/PROJECT_ID/deploy ${h} \\\n  -H "content-type: application/json" -d '{}'`],
  ];
  return (
    <section className="panel rounded-3xl p-6">
      <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Quick start</div>
      <div className="mt-4 space-y-4">
        {snippets.map(([title, code]) => (
          <div key={title}>
            <div className="mb-1.5 text-[13px] font-semibold">{title}</div>
            <pre className="overflow-x-auto rounded-xl bg-elevated px-4 py-3 font-mono text-[12px] leading-relaxed">{code}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
