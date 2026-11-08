import { currentUserOrRedirect } from "@/lib/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { planLimits } from "@/lib/plans";
import { aiUsageToday } from "@/lib/ai/usage";
import { getSettings, publicSettings } from "@/lib/ai/settings";
import { shortAddress } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { Gauge } from "@/components/dashboard/gauge";
import { HopText } from "@/components/motion/hop-text";
import { AiSettings } from "@/components/settings/ai-settings";
import { ApiDocs, ApiKeys } from "@/components/settings/api-keys";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUserOrRedirect();
  const desktop = env.appMode === "desktop";
  const limits = planLimits(user.plan);
  const [usage, projects, settings, keys] = await Promise.all([
    aiUsageToday(user.id),
    prisma.project.count({ where: { userId: user.id } }),
    getSettings(user.id),
    desktop ? Promise.resolve([]) : prisma.apiKey.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const initial = (user.name || user.email || "S").charAt(0).toUpperCase();
  const plan = user.plan === "PRO" ? "Pro" : "Free";

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <div className="text-[12px] shimmer font-medium tracking-[0.02em]">Settings</div>
        <HopText as="h1" trigger="load" text={desktop ? "AI & publishing" : "Account & AI"} className="mt-1 text-[clamp(1.7rem,3vw,2.3rem)] font-black tracking-[-0.03em]" />
      </div>

      <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-5">
          {!desktop && (
            <section className="panel flex flex-col items-center rounded-3xl p-6 text-center">
              <span className="grid size-20 place-items-center rounded-2xl bg-[image:var(--primary)] text-[32px] font-black text-[color:var(--on-primary)]">
                {initial}
              </span>
              <div className="mt-4 text-[18px] font-bold tracking-tight">{user.name ?? "Unnamed builder"}</div>
              <div className="text-[13px] text-subtle">{user.email ?? "Signed in with Privy"}</div>
              <span className="btn-primary mt-4 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">{plan} plan</span>
              <div className="mt-6 w-full">
                <LogoutButton />
              </div>
            </section>
          )}
          <section className="panel rounded-3xl p-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-subtle">Today</div>
            <div className="mt-4 flex flex-wrap justify-around gap-6">
              <Gauge used={projects} max={limits.maxProjects} label="Apps" size={112} />
            </div>
            <dl className="mt-4 space-y-1 text-center text-[13px]">
              <div>
                <dt className="inline text-subtle">AI runs: </dt>
                <dd className="inline font-semibold tabular-nums">{usage.requests}</dd>
              </div>
              <div>
                <dt className="inline text-subtle">Tokens: </dt>
                <dd className="inline font-semibold tabular-nums">{usage.tokens.toLocaleString("en-US")}</dd>
              </div>
            </dl>
            {!desktop && user.walletAddress && <p className="mt-4 text-center text-[12px] text-subtle">Wallet {shortAddress(user.walletAddress)}</p>}
          </section>
        </div>

        <div className="space-y-5">
          <AiSettings initial={publicSettings(settings)} />
          {!desktop && (
            <>
              <ApiKeys initialKeys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))} />
              <ApiDocs />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
