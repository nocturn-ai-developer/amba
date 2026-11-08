import "server-only";
import { prisma } from "@/lib/db";

function startOfUtcDay() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Today's AI runs and tokens for a user. Informational only: users pay their own AI provider. */
export async function aiUsageToday(userId: string) {
  const since = startOfUtcDay();
  const [requests, tokens] = await Promise.all([
    prisma.usage.count({ where: { userId, kind: "ai.generate", createdAt: { gte: since } } }),
    prisma.usage.aggregate({
      where: { userId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true },
    }),
  ]);
  return { requests, tokens: (tokens._sum.inputTokens ?? 0) + (tokens._sum.outputTokens ?? 0) };
}

export async function recordUsage(data: {
  userId: string;
  projectId?: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number;
  success: boolean;
}) {
  await prisma.usage.create({ data });
}
