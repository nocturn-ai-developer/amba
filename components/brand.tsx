import Link from "next/link";
import { cn } from "@/lib/utils";

/** Product name, in one place. */
export const BRAND = "stardoom ai";
export const BRAND_TITLE = "Stardoom AI";

/** Stardoom AI mark: a faceted 3D star, drawn in ink (facets shaded by opacity) so it follows the theme. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("inline-block size-[22px] shrink-0 text-fg", className)}>
      <g strokeLinejoin="round" strokeWidth="1.2" fill="currentColor" stroke="currentColor">
        <path d="M32.0 32.0 L32.0 2.0 L25.6 25.6 Z" opacity="0.62" />
        <path d="M32.0 32.0 L32.0 2.0 L38.4 25.6 Z" opacity="0.73" />
        <path d="M32.0 32.0 L62.0 32.0 L38.4 25.6 Z" opacity="1.0" />
        <path d="M32.0 32.0 L62.0 32.0 L38.4 38.4 Z" opacity="1.0" />
        <path d="M32.0 32.0 L32.0 62.0 L38.4 38.4 Z" opacity="0.73" />
        <path d="M32.0 32.0 L32.0 62.0 L25.6 38.4 Z" opacity="0.62" />
        <path d="M32.0 32.0 L2.0 32.0 L25.6 38.4 Z" opacity="0.35" />
        <path d="M32.0 32.0 L2.0 32.0 L25.6 25.6 Z" opacity="0.35" />
      </g>
    </svg>
  );
}

/** Wordmark: Orbitron black caps with a raised ring, as on the landing page. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-start font-[family-name:var(--font-display)] text-[19px] font-black uppercase tracking-[0.15em] text-fg transition-opacity hover:opacity-80", className)}
    >
      {BRAND}
      <span className="-mt-0.5 ml-0.5 text-[0.45em]">˚</span>
    </Link>
  );
}

/** $STARDOOM token symbol. */
export const TOKEN_SYMBOL = "STARDOOM";

/** Official X (Twitter) account. */
export const X_HANDLE = "stardoom_ai";
export const X_URL = `https://x.com/${X_HANDLE}`;

/** The X logo (lucide ships no brand marks). */
export function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className={cn("size-4", className)}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
