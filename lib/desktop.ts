import "server-only";
import { prisma } from "@/lib/db";

/**
 * The desktop app has exactly one user: whoever runs it. There is no login; the Electron shell guards the
 * local server with a per-launch token cookie (see middleware.ts), so other programs on the machine can't use it.
 */
export const LOCAL_PRIVY_ID = "local:desktop";
export const DESKTOP_COOKIE = "stardoom_desktop";

const select = { id: true, name: true, email: true, walletAddress: true, role: true, plan: true, disabled: true, createdAt: true } as const;

const g = globalThis as unknown as { __localUserId?: Promise<string> };

/** Finds or creates the local user once per process (parallel first requests share one creation). */
function localUserId(): Promise<string> {
  g.__localUserId ??= (async () => {
    const found = await prisma.user.findUnique({ where: { privyId: LOCAL_PRIVY_ID }, select: { id: true } });
    if (found) return found.id;
    // PRO limits: the projects live on the user's own disk.
    const created = await prisma.user.create({ data: { privyId: LOCAL_PRIVY_ID, name: "You", plan: "PRO" }, select: { id: true } });
    return created.id;
  })().catch((err) => {
    g.__localUserId = undefined;
    throw err;
  });
  return g.__localUserId;
}

export async function localUser() {
  return prisma.user.findUniqueOrThrow({ where: { id: await localUserId() }, select });
}
