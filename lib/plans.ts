import type { Plan } from "@prisma/client";

export interface PlanLimits {
  maxProjects: number;
  maxProjectSizeBytes: number;
}

function n(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Limits are configuration, not code: every number can be overridden by env. AI usage is unlimited: users pay their own provider. */
export function planLimits(plan: Plan): PlanLimits {
  if (plan === "PRO") {
    return {
      maxProjects: n("PRO_MAX_PROJECTS_PER_USER", 50),
      maxProjectSizeBytes: n("PRO_MAX_PROJECT_SIZE_MB", 5120) * 1024 * 1024,
    };
  }
  return {
    maxProjects: n("MAX_PROJECTS_PER_USER", 5),
    maxProjectSizeBytes: n("MAX_PROJECT_SIZE_MB", 100) * 1024 * 1024,
  };
}
