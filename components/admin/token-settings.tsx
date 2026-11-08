"use client";

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/misc";
import { explorerToken } from "@/lib/chains/robinhood";

interface Token {
  address: string | null;
  buyUrl: string | null;
}

/** Admin form for the $STARDOOM contract address (CA) and buy link shown on the landing page. */
export function TokenSettings({ initial }: { initial: Token }) {
  const [address, setAddress] = useState(initial.address ?? "");
  const [buyUrl, setBuyUrl] = useState(initial.buyUrl ?? "");
  const [saved, setSaved] = useState<Token>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const dirty = address.trim() !== (saved.address ?? "") || buyUrl.trim() !== (saved.buyUrl ?? "");

  async function save() {
    setBusy(true);
    setError(null);
    setWarnings([]);
    setDone(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenAddress: address, buyUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      const token = data.token as Token;
      setSaved(token);
      setAddress(token.address ?? "");
      setBuyUrl(token.buyUrl ?? "");
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">$STARDOOM token</h2>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-muted">
          The contract address (CA) is shown on the landing page with a copy button, and Battleground uses it to check that voters hold
          $STARDOOM. Leave it empty until launch: the site then says the CA is announced at launch.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="token-address">Contract address (CA)</Label>
          <Input
            id="token-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="token-buy">Buy link (optional)</Label>
          <Input id="token-buy" value={buyUrl} onChange={(e) => setBuyUrl(e.target.value)} placeholder="https://…" spellCheck={false} autoComplete="off" />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warning">
            {w}
          </p>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </Button>
          {done && !dirty && (
            <span className="flex items-center gap-1 text-sm text-muted">
              <Check className="size-4" /> Saved. The landing page updates within a minute.
            </span>
          )}
          {saved.address && (
            <a href={explorerToken(saved.address)} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-sm text-muted hover:text-fg">
              View on explorer <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </Card>
    </section>
  );
}
