"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, ChevronRight, Copy, X } from "lucide-react";
import { BrandMark, TOKEN_SYMBOL, X_HANDLE, X_URL } from "@/components/brand";
import type { PlatformStats } from "@/lib/stats";

// Aestra, the brand character. The suit is always visible; the armour beneath shows only inside the cursor spotlight.
// Both renders share one pose and framing, so the reveal lines up. Upscaled 2x (lanczos + light sharpen) from the
// 1672px originals so 1920px and retina screens are not stretching them. The photo's edges fade into the black page.
// Black-shirt edit of aestra-suit.webp (scripts/make-black-shirt.py); the armour render is unchanged.
const BG_IMAGE_1 = "/landing/aestra-suit-black.webp?v=1";
const BG_IMAGE_2 = "/landing/aestra-armor.webp?v=3";

/** The character pair: what is always visible, and what the cursor spotlight reveals. Same pose and framing. */
export interface HeroImages {
  outer: string;
  inner: string;
}
const DEFAULT_HERO: HeroImages = { outer: BG_IMAGE_1, inner: BG_IMAGE_2 };

export interface TokenTerms {
  asOf: string;
  chainId: number;
  launchFee: string;
  curveFee: string;
  supply: string;
  graduation: string;
  config: string;
  factory: string;
  factoryUrl: string;
  economics: string | null;
}

/** The $STARDOOM contract as set by an admin at /admin; null until launch. */
export interface TokenContract {
  address: string;
  short: string;
  explorerUrl: string;
  buyUrl: string | null;
}

/** Public plan facts, formatted on the server. */
export interface Pricing {
  freeProjects: number;
}

type Panel = "workflow" | "features" | "token" | "pricing" | "faq" | "start";

const NAV: { id: Exclude<Panel, "start">; label: string }[] = [
  { id: "workflow", label: "Workflow" },
  { id: "features", label: "Features" },
  { id: "token", label: "Token" },
  { id: "pricing", label: "API" },
  { id: "faq", label: "FAQ" },
];

const SUGGESTIONS = ["Portfolio for a photographer", "Coffee shop menu", "Meme coin landing page", "Habit tracker"];

/** One full-viewport composition on black: the character centred, the pitch around it, details in side drawers. */
export function Landing({
  signedIn,
  domain,
  stats,
  token,
  ca = null,
  pricing,
  hero = DEFAULT_HERO,
}: {
  signedIn: boolean;
  domain: string;
  stats: PlatformStats | null;
  token: TokenTerms | null;
  /** $STARDOOM contract address (admin setting). */
  ca?: TokenContract | null;
  pricing: Pricing;
  /** A replacement character (scripts/prepare-hero.py); defaults to Aestra. */
  hero?: HeroImages;
}) {
  const [panel, setPanel] = useState<Panel>("workflow");
  const [open, setOpen] = useState(false);

  const show = (p: Panel) => {
    setPanel(p);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={`landing font-jakarta relative flex min-h-dvh flex-col justify-between overflow-hidden bg-black text-white antialiased`}
    >
      <ImageRevealBackground hero={hero} />
      <MobileBackdrop />

      {/* Header: mark + wordmark, the section nav in one pill, account actions. */}
      <header
        className="relative z-20 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 lg:grid-cols-[1fr_auto_1fr]"
        style={{ paddingInline: "var(--pad-x)", paddingTop: "var(--header-pt)" }}
      >
        <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5 justify-self-start transition-opacity hover:opacity-80">
          <BrandMark className="size-[1.4em] text-white" />
          <span className="font-orbitron whitespace-nowrap font-black" style={{ fontSize: "var(--logo)", letterSpacing: "0.12em" }}>
            STARDOOM AI
          </span>
        </Link>
        <nav
          aria-label="Sections"
          className="col-span-2 row-start-2 flex items-center justify-between gap-0.5 overflow-x-auto rounded-full border border-white/15 bg-black/45 p-1 backdrop-blur-md lg:col-span-1 lg:col-start-2 lg:row-start-1"
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => show(n.id)}
              className="whitespace-nowrap rounded-full px-2.5 py-1.5 font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:px-3.5"
              style={{ fontSize: "var(--nav)" }}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4 justify-self-end lg:col-start-3">
          <Link href={signedIn ? "/dashboard" : "/login"} className="hidden whitespace-nowrap font-medium text-white/70 transition-colors hover:text-white sm:inline" style={{ fontSize: "var(--nav)" }}>
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
          <button
            type="button"
            onClick={() => show("start")}
            className="whitespace-nowrap rounded-full bg-white px-4 py-2 font-semibold text-black transition-opacity hover:opacity-85"
            style={{ fontSize: "var(--nav)" }}
          >
            Launch app
          </button>
        </div>
      </header>

      {/* Hero: the headline splits around the character; the prompt sits at her feet. */}
      <main className="relative z-10 flex flex-1 flex-col" style={{ paddingInline: "var(--pad-x)", paddingTop: "var(--main-py)", paddingBottom: "calc(var(--main-py) * 0.6)" }}>
        <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,30vw)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="mb-4 font-mono uppercase text-white/55" style={{ fontSize: "var(--micro)", letterSpacing: "0.22em" }}>
              <span className="mr-2 text-white">▲</span>AI app builder
            </p>
            <h1 className="font-orbitron font-black uppercase" style={{ fontSize: "var(--headline)", letterSpacing: "0.06em", lineHeight: 0.98 }}>
              Build
              <br />
              anything
              <span className="lg:hidden"> with AI.</span>
            </h1>
            <p className="mt-5 max-w-[24rem] leading-relaxed text-white/60" style={{ fontSize: "var(--body)" }}>
              Describe your idea in one sentence. The AI writes the code, and your app goes live on its own domain.
            </p>
          </div>

          {/* The character stands here (background layer). */}
          <div aria-hidden className="hidden lg:block" />

          <div className="hidden min-w-0 text-right lg:block">
            <p className="mb-4 font-mono uppercase text-white/55" style={{ fontSize: "var(--micro)", letterSpacing: "0.22em" }}>
              Web · Windows · macOS
            </p>
            <p className="font-orbitron font-black uppercase" style={{ fontSize: "var(--headline)", letterSpacing: "0.06em", lineHeight: 0.98 }}>
              With
              <br />
              AI.
            </p>
            <p className="ml-auto mt-5 max-w-[22rem] leading-relaxed text-white/60" style={{ fontSize: "var(--body)" }}>
              Your own Anthropic key on the web, or a local model on your computer. Every app can launch its own token on Robinhood Chain.
            </p>
          </div>
        </div>

        <HeroPrompt signedIn={signedIn} stats={stats} />
      </main>

      <Ticker ca={ca} />

      <Drawer open={open} panel={panel} onClose={() => setOpen(false)}>
        {panel === "workflow" && <WorkflowPanel domain={domain} />}
        {panel === "features" && <FeaturesPanel domain={domain} />}
        {panel === "token" && <TokenPanel token={token} ca={ca} />}
        {panel === "pricing" && <PricingPanel pricing={pricing} signedIn={signedIn} />}
        {panel === "faq" && <FaqPanel domain={domain} />}
        {panel === "start" && <StartPanel signedIn={signedIn} />}
      </Drawer>
    </div>
  );
}



/** Inline prompt in the hero: type the idea, Generate opens the builder with it (sign-in first if needed). */
function HeroPrompt({ signedIn, stats }: { signedIn: boolean; stats: PlatformStats | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  function go(text = value) {
    const prompt = text.trim().slice(0, 2000);
    const target = prompt ? `/dashboard/new?prompt=${encodeURIComponent(prompt)}` : "/dashboard/new";
    router.push(signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`);
  }
  return (
    <div className="mx-auto mt-8 w-full max-w-[44rem]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
        className="flex items-center gap-2 rounded-2xl border border-white/15 bg-black/55 p-2 pl-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md transition-colors focus-within:border-white/40"
      >
        <span aria-hidden className="font-mono text-white/40" style={{ fontSize: "var(--body)" }}>
          &gt;
        </span>
        <input
          id="hero-prompt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={2000}
          placeholder="A booking page for my pottery studio…"
          aria-label="Describe the app you want to build"
          className="min-w-0 flex-1 bg-transparent py-2 text-white outline-none placeholder:text-white/35"
          style={{ fontSize: "var(--body)" }}
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 font-semibold uppercase text-black transition-opacity hover:opacity-85"
          style={{ fontSize: "var(--micro)", letterSpacing: "0.16em" }}
        >
          Generate <ArrowUpRight strokeWidth={2} className="size-[1.2em]" />
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {SUGGESTIONS.map((sug) => (
          <button
            key={sug}
            type="button"
            onClick={() => setValue(sug)}
            className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-white/65 backdrop-blur transition-colors hover:border-white/40 hover:text-white"
            style={{ fontSize: "var(--micro)" }}
          >
            {sug}
          </button>
        ))}
      </div>
      {stats && (
        <p className="mt-3 text-center font-mono uppercase text-white/40" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
          {stats.projects.toLocaleString("en-US")} apps built · {stats.liveDeployments.toLocaleString("en-US")} live now
        </p>
      )}
    </div>
  );
}

const TICKER_ITEMS = [TOKEN_SYMBOL.startsWith("$") ? TOKEN_SYMBOL : `$${TOKEN_SYMBOL}`, "Robinhood Chain", "Describe it", "AI builds it", "Live on its own domain", "Web · Windows · macOS", "Local AI or your own key", `@${X_HANDLE}`];

/** Bottom strip: the pitch scrolling by, set in mono like a market ticker. The CA joins it once set. */
function Ticker({ ca }: { ca: TokenContract | null }) {
  const items: React.ReactNode[] = [...TICKER_ITEMS];
  // Hex stays in its own case: an uppercased "0X…" reads wrong and gets mistyped.
  if (ca) items.splice(1, 0, <>CA <span className="normal-case">{ca.short}</span></>);
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span key={i} className="flex items-center whitespace-nowrap px-6">
          <span aria-hidden className="mr-6 text-white/30">
            ▲
          </span>
          {t}
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative z-10 overflow-hidden border-t border-white/10 bg-black/60 py-3 font-mono uppercase text-white/70 backdrop-blur" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
      <div className="landing-ticker flex w-max">
        {row}
        <div aria-hidden className="flex">
          {row}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive background                                              */
/* ------------------------------------------------------------------ */

/** Below lg: a faint grid on black, in place of the photo background. */
function MobileBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 lg:hidden"
      style={{
        backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.5) 45%, transparent 85%)",
      }}
    />
  );
}

// The mask canvas is drawn at a fraction of the photo size; the gradient is soft, so upscaling is invisible.
const MASK_SCALE = 0.25;

// The photo starts just below the header so the hood clears the navigation.
const PHOTO_TOP = "clamp(3.5rem, 9vh, 6rem)";

// Edges of the photo melt into the black page; the middle (where she stands) stays clear.
const FADE = [
  "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0) 14%)",
  "linear-gradient(to top, #000 0%, rgba(0,0,0,0) 8%)",
  "linear-gradient(to right, #000 0%, rgba(0,0,0,0.8) 10%, rgba(0,0,0,0.35) 20%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.35) 80%, rgba(0,0,0,0.8) 90%, #000 100%)",
].join(", ");

/** Desktop only: the inner image is revealed through a soft spotlight that trails the cursor, over a parallax grid. */
function ImageRevealBackground({ hero }: { hero: HeroImages }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const patternRef = useRef<SVGPatternElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const photo = photoRef.current;
    const reveal = revealRef.current;
    const pattern = patternRef.current;
    const path = pathRef.current;
    if (!root || !photo || !reveal || !pattern || !path) return;
    // Skip the whole loop when the background is hidden (below lg).
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const smooth = { ...mouse };
    const grid = { x: 0, y: 0 };
    let last = { x: NaN, y: NaN, w: 0, h: 0 };
    let frame = 0;

    const resize = () => {
      const cell = Math.round(Math.min(64, Math.max(36, window.innerWidth * 0.028)));
      pattern.setAttribute("width", String(cell));
      pattern.setAttribute("height", String(cell));
      path.setAttribute("d", `M ${cell} 0 L 0 0 0 ${cell}`);
      last = { x: NaN, y: NaN, w: 0, h: 0 };
    };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const tick = () => {
      smooth.x += (mouse.x - smooth.x) * 0.1;
      smooth.y += (mouse.y - smooth.y) * 0.1;

      // The mask covers the photo box (it starts below the wordmark), so cursor positions are taken relative to it.
      const r = photo.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * MASK_SCALE));
      const h = Math.max(1, Math.round(r.height * MASK_SCALE));
      // Only redraw the mask while the spotlight is still moving.
      if (Math.abs(smooth.x - last.x) > 0.1 || Math.abs(smooth.y - last.y) > 0.1 || Number.isNaN(last.x) || w !== last.w || h !== last.h) {
        last = { x: smooth.x, y: smooth.y, w, h };
        canvas.width = w;
        canvas.height = h;
        const radius = Math.round(Math.min(420, Math.max(160, window.innerWidth * 0.16))) * MASK_SCALE;
        const cx = (smooth.x - r.left) * MASK_SCALE;
        const cy = (smooth.y - r.top) * MASK_SCALE;
        ctx.clearRect(0, 0, w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.4, "rgba(255,255,255,1)");
        g.addColorStop(0.6, "rgba(255,255,255,0.75)");
        g.addColorStop(0.75, "rgba(255,255,255,0.4)");
        g.addColorStop(0.88, "rgba(255,255,255,0.12)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        const url = `url(${canvas.toDataURL()})`;
        reveal.style.maskImage = url;
        reveal.style.webkitMaskImage = url;
      }

      // Grid drifts against the cursor.
      const rr = root.getBoundingClientRect();
      const nx = (smooth.x - rr.left) / rr.width - 0.5;
      const ny = (smooth.y - rr.top) / rr.height - 0.5;
      grid.x += (nx * 16 - grid.x) * 0.06;
      grid.y += (ny * 16 - grid.y) * 0.06;
      pattern.setAttribute("x", grid.x.toFixed(2));
      pattern.setAttribute("y", grid.y.toFixed(2));

      frame = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  const layer = "absolute inset-0 bg-cover bg-top bg-no-repeat";
  return (
    <div ref={rootRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden bg-black lg:block">
      <div ref={photoRef} className="absolute inset-x-0 bottom-0" style={{ top: PHOTO_TOP }}>
        <div className={layer} style={{ backgroundImage: `url("${hero.outer}")` }} />
        <div
          ref={revealRef}
          className={layer}
          style={{ backgroundImage: `url("${hero.inner}")`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat" }}
        />
        <div className="absolute inset-0" style={{ backgroundImage: FADE }} />
      </div>
      <svg className="absolute inset-0 size-full" style={{ opacity: 0.12 }}>
        <defs>
          <pattern ref={patternRef} id="landing-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path ref={pathRef} d="M 48 0 L 0 0 0 48" fill="none" stroke="#94a3b8" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#landing-grid)" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

const TITLES: Record<Panel, string> = {
  workflow: "Workflow",
  features: "Features",
  token: "Token Launch",
  pricing: "API & Pricing",
  faq: "FAQ",
  start: "New Project",
};

function Drawer({ open, panel, onClose, children }: { open: boolean; panel: Panel; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} inert={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/20 backdrop-blur-xs transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={TITLES[panel]}
        className={`absolute inset-y-0 right-0 flex w-full flex-col border-l border-gray-200 bg-white text-black transition-transform duration-300 ease-out sm:max-w-[var(--drawer-max)] ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ padding: "var(--drawer-pad)" }}
      >
        <div className="flex items-center justify-between border-b border-gray-200 pb-[var(--section-gap)]">
          <h2 className="font-orbitron uppercase" style={{ fontWeight: 700, letterSpacing: "0.12em", fontSize: "calc(var(--logo) * 0.7)" }}>
            {TITLES[panel]}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="transition-opacity hover:opacity-50">
            <X strokeWidth={1.5} style={{ width: "var(--icon)", height: "var(--icon)" }} />
          </button>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1 py-[var(--section-gap)]">{children}</div>
        <div className="border-t border-gray-200 pt-[var(--section-gap)] text-center uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
          Stardoom AI © {new Date().getFullYear()} — Build anything with AI
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="mt-1 block transition-colors hover:text-black">
            @{X_HANDLE} on X
          </a>
        </div>
      </aside>
    </div>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-1 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.2em" }}>
      {children}
    </div>
  );
}

/** A drawer row: micro label, title, body. */
function Row({ label, title, body, aside }: { label?: string; title: string; body?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-4 border-b border-gray-200 py-4 last:border-b-0">
      <div className="min-w-0">
        {label && (
          <div className="uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
            {label}
          </div>
        )}
        <div className="mt-1 font-semibold uppercase" style={{ fontSize: "var(--body)", letterSpacing: "0.12em" }}>
          {title}
        </div>
        {body && <p className="mt-1.5 leading-relaxed text-gray-600" style={{ fontSize: "var(--body)" }}>{body}</p>}
      </div>
      {aside}
    </li>
  );
}

function WorkflowPanel({ domain }: { domain: string }) {
  const steps = [
    ["Say what you want", "One sentence is enough to start. Add detail whenever you like."],
    ["Relevant files only", "Claude pulls in the files your request touches and nothing else."],
    ["Precise edits", "Changes land where they belong. The rest of your app stays put."],
    ["Verified build", "Type-checked and bundled in an isolated sandbox, repaired if it fails."],
    ["Published", `Your app gets its own address at {name}.${domain} with HTTPS, ready to share.`],
    ["Token, if you want", "Launch a project token on Pons V2, signed by your wallet."],
  ];
  return (
    <>
      <Subtitle>Six steps · you only do the first</Subtitle>
      <ol>
        {steps.map(([title, body], i) => (
          <Row key={title} label={`Step ${String(i + 1).padStart(2, "0")}`} title={title!} body={body} />
        ))}
      </ol>
    </>
  );
}

function FeaturesPanel({ domain }: { domain: string }) {
  const features = [
    ["Talk, don't type code", "Ask for changes in plain words. Claude edits only what the request needs and leaves your design alone."],
    ["Watch it update", "A live preview refreshes after every verified build."],
    ["Ship in one click", "Redeploys swap atomically. A failed build never takes the live version down."],
    ["Your own address", `Every project lives at {name}.${domain} with a certificate issued on demand.`],
    ["Isolated by default", "Each project builds and runs in its own container with CPU and memory limits."],
  ];
  const safety = [
    ["Sealed builds", "No root, no host files. Each project gets its own container."],
    ["Secrets stay server-side", "Platform keys never reach generated apps or the browser."],
    ["You sign everything", "Your wallet, your signature. Nothing is signed for you."],
    ["Checked on-chain", "Launch results are read from the real receipt and verified."],
  ];
  return (
    <>
      <Subtitle>Built for ideas, not toolchains</Subtitle>
      <ul>
        {features.map(([title, body]) => (
          <Row key={title} title={title!} body={body} />
        ))}
      </ul>
      <div className="mt-6">
        <Subtitle>Safety</Subtitle>
      </div>
      <ul>
        {safety.map(([title, body]) => (
          <Row key={title} title={title!} body={body} />
        ))}
      </ul>
    </>
  );
}

/** The official $STARDOOM contract with copy / explorer / buy, or a launch notice before it is set. */
function ContractAddress({ ca }: { ca: TokenContract | null }) {
  const [copied, setCopied] = useState(false);
  const micro = { fontSize: "var(--micro)", letterSpacing: "0.18em" } as const;
  if (!ca) {
    return (
      <div className="mb-6 border border-dashed border-gray-300 px-3 py-3">
        <div className="uppercase text-gray-500" style={micro}>
          Contract address
        </div>
        <p className="mt-1 font-semibold" style={{ fontSize: "var(--body)" }}>
          Announced at launch.
        </p>
        <p className="mt-1 text-gray-500" style={{ fontSize: "var(--micro)" }}>
          Only trust the CA posted on stardoom.org and @{X_HANDLE}.
        </p>
      </div>
    );
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ca.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the address is selectable */
    }
  };
  return (
    <div className="mb-6 border border-gray-200 px-3 py-3">
      <div className="flex items-center justify-between uppercase text-gray-500" style={micro}>
        <span>Contract address</span>
        <span>Robinhood Chain</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all break-all font-mono font-semibold" style={{ fontSize: "var(--body)" }}>
          {ca.address}
        </code>
        <button type="button" onClick={copy} aria-label="Copy contract address" className="shrink-0 rounded-full border border-gray-200 p-1.5 text-gray-600 hover:border-black hover:text-black">
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 uppercase text-gray-500" style={micro}>
        <a href={ca.explorerUrl} target="_blank" rel="noopener noreferrer" className="hover:text-black">
          Explorer ↗
        </a>
        {ca.buyUrl && (
          <a href={ca.buyUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-black hover:underline">
            Buy ${TOKEN_SYMBOL} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function TokenPanel({ token, ca }: { token: TokenTerms | null; ca: TokenContract | null }) {
  const terms: [string, string][] = token
    ? [
        ["Launch fee", token.launchFee],
        ["Creator tax", "1% – 4%"],
        ["Curve fee", token.curveFee],
        ["Supply", token.supply],
        ["Graduation", token.graduation],
        ["Chain id", String(token.chainId)],
      ]
    : [];
  const calls = [
    ["canLaunch(wallet)", "Eligibility is checked before the form appears."],
    ["previewLaunchEconomics(id, ETH)", token?.economics ? `Pinned in your params: ${token.economics}` : "Economics are pinned into your params."],
    ["launchToken(params) + fee", "Simulated first, then signed in your wallet."],
    ["TokenLaunched(token, curve)", "Read from the receipt and verified server-side."],
  ];
  return (
    <>
      <Subtitle>${TOKEN_SYMBOL}</Subtitle>
      <ContractAddress ca={ca} />
      <Subtitle>Pons V2 · Robinhood Chain</Subtitle>
      <p className="leading-relaxed text-gray-600" style={{ fontSize: "var(--body)" }}>
        Give your app a token in one signature. Terms are read from the factory again in your browser right before you sign.
      </p>
      <div className="mt-5 flex items-center gap-2 uppercase" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
        <span className={`size-1.5 rounded-full ${token ? "bg-black" : "bg-gray-300"}`} />
        {token ? "Live from chain" : "Chain unreachable right now"}
      </div>
      {token && (
        <>
          <dl className="mt-3 grid grid-cols-2 border-l border-t border-gray-200">
            {terms.map(([k, v]) => (
              <div key={k} className="border-b border-r border-gray-200 px-3 py-2.5">
                <dt className="uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
                  {k}
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums" style={{ fontSize: "var(--body)" }}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex justify-between gap-3 text-gray-500" style={{ fontSize: "var(--micro)" }}>
            <a href={token.factoryUrl} target="_blank" rel="noopener noreferrer" className="uppercase tracking-[0.18em] hover:text-black">
              Factory {token.factory} ↗
            </a>
            <span className="uppercase tracking-[0.18em]">Config {token.config}</span>
          </div>
        </>
      )}
      <div className="mt-6">
        <Subtitle>Call sequence</Subtitle>
      </div>
      <ol>
        {calls.map(([code, note], i) => (
          <Row key={code} label={String(i + 1).padStart(2, "0")} title={code!} body={note} />
        ))}
      </ol>
      <a
        href="https://docs.ponsfamily.com/docs/v2"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 uppercase text-gray-500 hover:text-black"
        style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}
      >
        Pons V2 docs <ArrowUpRight className="size-3" />
      </a>
    </>
  );
}

function PricingPanel({ pricing, signedIn }: { pricing: Pricing; signedIn: boolean }) {
  const target = "/dashboard/settings";
  return (
    <>
      <Subtitle>Bring your own key</Subtitle>
      <ul>
        <Row
          label="Free"
          title="Every account"
          body={`Up to ${pricing.freeProjects} apps, hosting on your own subdomain with HTTPS. Stardoom AI charges nothing for AI: runs use your own Anthropic API key and are billed by Anthropic at their prices.`}
          aside={<span className="font-orbitron font-bold" style={{ fontSize: "var(--body)" }}>$0</span>}
        />
      </ul>
      <div className="mt-6">
        <Subtitle>Desktop app</Subtitle>
      </div>
      <ul>
        <Row title="Windows & macOS" body="Build on your own machine with your Anthropic key or a local AI (Ollama, LM Studio, any OpenAI-compatible server). Publish to the web when you're ready." />
      </ul>
      <div className="mt-6">
        <Subtitle>API access</Subtitle>
      </div>
      <ul>
        <Row title="Personal API keys" body="Create apps, run the AI and deploy from scripts, bots and other tools with a stardoom_sk_ key. Runs use the Anthropic key saved in your settings." />
      </ul>
      <Link
        href={signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-black bg-black px-4 py-2.5 font-semibold uppercase text-white transition-colors hover:bg-white hover:text-black"
        style={{ fontSize: "var(--body)", letterSpacing: "0.18em" }}
      >
        Add your key <ArrowUpRight className="size-[1.1em]" strokeWidth={1.5} />
      </Link>
    </>
  );
}

function FaqPanel({ domain }: { domain: string }) {
  const faq = [
    ["Do I need coding experience?", "Not at all. Describe what you want and Claude makes the change. You can peek at the code in a read-only view if you're curious."],
    ["What kind of apps can I make?", "Single-page apps built with React, TypeScript and Tailwind: landing pages, portfolios, dashboards, small games and interactive tools."],
    ["Where is my app hosted?", `Each deployment runs in its own container and is served at {your-project}.${domain} with automatic HTTPS.`],
    ["Who controls the token launch?", "You do. Stardoom AI prepares the transaction from the current Pons V2 configuration, and your own wallet signs it. We never touch keys or seed phrases."],
    ["Will a token change my website?", "No. They're linked but independent. Editing your site later never touches the token's on-chain data."],
  ];
  return (
    <>
      <Subtitle>Good questions</Subtitle>
      <ul>
        {faq.map(([q, a]) => (
          <Row key={q} title={q!} body={a} />
        ))}
      </ul>
    </>
  );
}

/** Describe-your-app field: carries the prompt into the new-project page (via login if needed). */
function StartPanel({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go() {
    const prompt = value.trim().slice(0, 2000);
    const target = prompt ? `/dashboard/new?prompt=${encodeURIComponent(prompt)}` : "/dashboard/new";
    router.push(signedIn ? target : `/login?callbackUrl=${encodeURIComponent(target)}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <Subtitle>Describe the app you want</Subtitle>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={2000}
        rows={5}
        autoFocus
        placeholder="A booking page for my pottery studio…"
        aria-label="Describe the app you want to build"
        className="w-full resize-none rounded-md border border-gray-300 bg-white p-3 leading-relaxed outline-none transition-colors placeholder:text-gray-400 focus:border-black"
        style={{ fontSize: "var(--body)" }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className="rounded-md border border-gray-300 px-2.5 py-1 uppercase text-gray-600 transition-colors hover:border-black hover:text-black"
            style={{ fontSize: "var(--micro)", letterSpacing: "0.12em" }}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="submit"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-black py-3.5 font-semibold uppercase text-white transition-opacity hover:opacity-85"
        style={{ fontSize: "var(--body)", letterSpacing: "0.18em" }}
      >
        {signedIn ? "Generate" : "Sign in & generate"} <ChevronRight className="size-4" />
      </button>
      <div className="mt-6 space-y-2 uppercase text-gray-500" style={{ fontSize: "var(--micro)", letterSpacing: "0.18em" }}>
        <Link href="/dashboard/templates" className="flex items-center gap-1 hover:text-black">
          Browse templates <ArrowUpRight className="size-3" />
        </Link>
        <Link href="/battleground" className="flex items-center gap-1 hover:text-black">
          Every live app on the Battleground <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Ornaments                                                           */
/* ------------------------------------------------------------------ */


