import { statSync } from "fs";
import path from "path";
import { formatEther } from "viem";
import { currentUser } from "@/lib/session";
import { platformStats, ponsSnapshot } from "@/lib/stats";
import { explorerAddress, explorerToken } from "@/lib/chains/robinhood";
import { siteToken } from "@/lib/site-settings";
import { shortAddress } from "@/lib/utils";
import { baseDomain } from "@/lib/deployment/domain";
import { Landing, type HeroImages, type Pricing, type TokenContract, type TokenTerms } from "@/components/marketing/landing";
import { planLimits } from "@/lib/plans";

export const revalidate = 60;

/**
 * A new landing character dropped in by scripts/prepare-hero.py (public/landing/hero-outer.webp + hero-inner.webp).
 * Without both files the page keeps the default character. The file time busts browser caches when they change.
 */
function customHero(): HeroImages | undefined {
  try {
    const dir = path.join(process.cwd(), "public", "landing");
    const outer = statSync(path.join(dir, "hero-outer.webp"));
    const inner = statSync(path.join(dir, "hero-inner.webp"));
    return { outer: `/landing/hero-outer.webp?v=${Math.round(outer.mtimeMs)}`, inner: `/landing/hero-inner.webp?v=${Math.round(inner.mtimeMs)}` };
  } catch {
    return undefined;
  }
}

export default async function Home() {
  const [user, stats, pons, site] = await Promise.all([currentUser(), platformStats(), ponsSnapshot(), siteToken()]);
  const cfg = pons?.config;

  // Live Pons V2 terms, formatted on the server so the client bundle stays free of chain helpers.
  const token: TokenTerms | null = pons
    ? {
        asOf: new Date(pons.asOf).toUTCString().replace("GMT", "UTC"),
        chainId: pons.chainId,
        launchFee: `${formatEther(BigInt(pons.launchFee))} ETH`,
        curveFee: cfg ? `${Number(cfg.curveFeeBps) / 100}%` : "—",
        supply: cfg ? Number(formatEther(BigInt(cfg.supply))).toLocaleString("en-US", { notation: "compact" }) : "—",
        graduation: cfg ? `${Number(formatEther(BigInt(cfg.graduationThreshold)))} ETH` : "—",
        config: cfg ? `#${cfg.id} of ${pons.configCount}` : "—",
        factory: shortAddress(pons.factory, 6),
        factoryUrl: explorerAddress(pons.factory),
        economics: pons.economics ? shortAddress(pons.economics, 6) : null,
      }
    : null;

  const ca: TokenContract | null = site.address
    ? { address: site.address, short: shortAddress(site.address, 6), explorerUrl: explorerToken(site.address), buyUrl: site.buyUrl }
    : null;

  const free = planLimits("FREE");
  const pricing: Pricing = { freeProjects: free.maxProjects };

  return <Landing signedIn={!!user} domain={baseDomain()} stats={stats} token={token} ca={ca} pricing={pricing} hero={customHero()} />;
}
