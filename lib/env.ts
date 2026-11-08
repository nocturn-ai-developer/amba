import "server-only";
import path from "path";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid numeric env ${name}`);
  return Math.floor(n);
}

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Centralized, typed server configuration. Never import from client components. */
export const env = {
  /** "web" (stardoom.org: Privy login, Docker sandbox) or "desktop" (Electron app: one local user, no Docker). */
  get appMode(): "web" | "desktop" {
    return str("STARDOOM_MODE", "web") === "desktop" ? "desktop" : "web";
  },
  get anthropicModel() {
    return str("ANTHROPIC_MODEL", "claude-opus-5-5");
  },
  get anthropicEffort(): Effort {
    const e = str("ANTHROPIC_EFFORT", "high");
    return (["low", "medium", "high", "xhigh", "max"].includes(e) ? e : "high") as Effort;
  },
  get aiMaxOutputTokens() {
    return int("AI_MAX_OUTPUT_TOKENS", 64000);
  },
  get aiMaxAgentSteps() {
    return int("AI_MAX_AGENT_STEPS", 40);
  },
  get aiMaxRepairAttempts() {
    return int("AI_MAX_REPAIR_ATTEMPTS", 3);
  },
  get maxPromptChars() {
    return int("MAX_PROMPT_CHARS", 8000);
  },
  get domain() {
    return str("PRISMATIC_DOMAIN", "prismatic.com").toLowerCase();
  },
  get caddyAskSecret() {
    return str("CADDY_ASK_SECRET");
  },
  get deploymentMode(): "local" | "production" {
    return str("DEPLOYMENT_MODE", "local") === "production" ? "production" : "local";
  },
  get dockerHost() {
    return str("DOCKER_HOST");
  },
  get runtimeImage() {
    return str("RUNTIME_IMAGE", "prismatic-runtime:latest");
  },
  get projectNetwork() {
    return str("PROJECT_NETWORK", "prismatic_projects");
  },
  get containerMemoryMb() {
    return int("CONTAINER_MEMORY_MB", 512);
  },
  get containerCpus() {
    return Number(str("CONTAINER_CPUS", "1")) || 1;
  },
  get containerPidsLimit() {
    return int("CONTAINER_PIDS_LIMIT", 256);
  },
  get buildTimeoutSeconds() {
    return int("BUILD_TIMEOUT_SECONDS", 180);
  },
  get storagePath() {
    return path.resolve(str("STORAGE_PATH", path.join(process.cwd(), "storage")));
  },
  get redisUrl() {
    return str("REDIS_URL");
  },
  get robinhoodRpcUrl() {
    return str("ROBINHOOD_RPC_URL", "https://rpc.mainnet.chain.robinhood.com");
  },

  /* Stardoom Pass (lib/nft) and sponsored launches (lib/pons/sponsor). */
  /** StardoomPass ERC-721 on Robinhood Chain (default: the live contract). */
  get passContract() {
    return str("PASS_CONTRACT_ADDRESS", "0xeaa60c3abe6259042ff099c4200cb2c1b0db46f0");
  },
  /**
   * Hot wallet that pays launch fee + gas for free launches. Keep only a small balance in it.
   * Read only by lib/pons/sponsor.ts and scripts/deploy-pass.mjs; never logged or returned.
   */
  get sponsorPrivateKey() {
    return str("SPONSOR_PRIVATE_KEY");
  },
  /** Most free launches the sponsor wallet pays for per UTC day across all passes (cost guard). */
  get freeLaunchDailyCap() {
    return int("FREE_LAUNCH_DAILY_CAP", 500);
  },

  /**
   * Fallback $STARDOOM address. The live value is set by an admin at /admin (lib/site-settings.ts) and wins
   * over this; empty means "not launched yet".
   */
  get creditsToken() {
    return str("CREDITS_TOKEN_ADDRESS", "");
  },
  /** Battleground voters must hold at least this much $STARDOOM (in USD at the live price). 0 turns it off. */
  get voteMinHoldUsd() {
    const v = Number(str("VOTE_MIN_HOLD_USD", "1"));
    return Number.isFinite(v) && v >= 0 ? v : 1;
  },
};
