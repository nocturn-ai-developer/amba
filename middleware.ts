import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/config";

const webAuth = NextAuth(authConfig).auth as unknown as (req: NextRequest, ev: NextFetchEvent) => Promise<Response | undefined>;

const PROTECTED = ["/dashboard", "/project", "/admin"];

/** Constant-time string comparison. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Web: redirects unauthenticated users away from protected pages (APIs check auth themselves).
 * Desktop: every request must carry the per-launch token cookie the Electron shell sets, so other local
 * programs and websites can't drive the app's server on 127.0.0.1. There is no login page.
 */
export default async function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  if (process.env.STARDOOM_MODE === "desktop") {
    const expected = process.env.STARDOOM_DESKTOP_TOKEN ?? "";
    const got = req.cookies.get("stardoom_desktop")?.value ?? "";
    if (!expected || !same(got, expected)) return new NextResponse("Open Stardoom from the desktop app.", { status: 403 });
    if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/battleground" || pathname === "/pass") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return webAuth(req, ev);
  return NextResponse.next();
}

export const config = {
  // Node.js runtime: env (STARDOOM_MODE, the per-launch token) is read when the server starts, not baked in at build.
  runtime: "nodejs",
  // Everything except static assets (desktop mode guards API routes too).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)"],
};
