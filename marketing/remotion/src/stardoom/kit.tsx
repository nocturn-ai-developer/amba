import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Sfx, display, ease, rise, sans } from "../ui";

/** Stardoom AI palette: the black landing page (white ink, zinc greys). */
export const D = {
  bg: "#050506",
  panel: "#0e0e11",
  panel2: "#16161a",
  ink: "#f4f4f6",
  muted: "#a1a1aa",
  subtle: "#71717a",
  faint: "#3f3f46",
  line: "#26262b",
  good: "#86efac",
};

export const mono = "'JetBrains Mono', ui-monospace, Consolas, monospace";
export const DOMAIN = "stardoom.org";
export const TICKER = "$STARDOOM";
export const HANDLE = "@stardoom_ai";

/** Faint drafting grid on black, drifting slowly. */
export function DGrid({ opacity = 1, size = 64, drift = 0.15 }: { opacity?: number; size?: number; drift?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity,
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${-frame * drift}px ${-frame * drift}px`,
        maskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, #000 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 50%, #000 30%, transparent 100%)",
      }}
    />
  );
}

/** The faceted 3D star mark, light facets for the dark background. */
export function DMark({ size = 48, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={style}>
      <g strokeLinejoin="round" strokeWidth="0.6">
        <path d="M32.0 32.0 L32.0 2.0 L25.6 25.6 Z" fill="#99999b" stroke="#99999b" />
        <path d="M32.0 32.0 L32.0 2.0 L38.4 25.6 Z" fill="#b3b3b5" stroke="#b3b3b5" />
        <path d="M32.0 32.0 L62.0 32.0 L38.4 25.6 Z" fill="#f4f4f6" stroke="#f4f4f6" />
        <path d="M32.0 32.0 L62.0 32.0 L38.4 38.4 Z" fill="#f4f4f6" stroke="#f4f4f6" />
        <path d="M32.0 32.0 L32.0 62.0 L38.4 38.4 Z" fill="#b3b3b5" stroke="#b3b3b5" />
        <path d="M32.0 32.0 L32.0 62.0 L25.6 38.4 Z" fill="#99999b" stroke="#99999b" />
        <path d="M32.0 32.0 L2.0 32.0 L25.6 38.4 Z" fill="#59595a" stroke="#59595a" />
        <path d="M32.0 32.0 L2.0 32.0 L25.6 25.6 Z" fill="#59595a" stroke="#59595a" />
      </g>
    </svg>
  );
}

/** STARDOOM AI˚ wordmark. */
export function DWordmark({ size = 28, color = D.ink, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", fontFamily: display, fontWeight: 900, fontSize: size, letterSpacing: "0.15em", color, whiteSpace: "nowrap", ...style }}>
      STARDOOM AI
      <span style={{ fontSize: size * 0.45, marginLeft: 2, marginTop: -size * 0.05 }}>˚</span>
    </div>
  );
}

export function DCorner({ pos, size = 16, color = D.ink, style }: { pos: "tl" | "tr" | "bl" | "br"; size?: number; color?: string; style?: React.CSSProperties }) {
  const d = { tl: "M0 11.5V0.5H11.5", tr: "M0.5 0.5H11.5V11.5", bl: "M0 0.5V11.5H11.5", br: "M0.5 11.5H11.5V0.5" }[pos];
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} fill="none" style={style}>
      <path d={d} stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

/** Four corner brackets around an absolutely positioned box. */
export function DFrame({ size = 16, color = D.ink, inset = 0 }: { size?: number; color?: string; inset?: number }) {
  return (
    <>
      <DCorner pos="tl" size={size} color={color} style={{ position: "absolute", left: inset, top: inset }} />
      <DCorner pos="tr" size={size} color={color} style={{ position: "absolute", right: inset, top: inset }} />
      <DCorner pos="bl" size={size} color={color} style={{ position: "absolute", left: inset, bottom: inset }} />
      <DCorner pos="br" size={size} color={color} style={{ position: "absolute", right: inset, bottom: inset }} />
    </>
  );
}

export function DCheck({ size = 18, color = D.good }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 L10 17.5 L19 7" />
    </svg>
  );
}

export function DSpinner({ size = 18 }: { size?: number }) {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${frame * 14}deg)` }}>
      <circle cx="12" cy="12" r="9" stroke={D.faint} strokeWidth="3" />
      <path d="M12 3 a9 9 0 0 1 9 9" stroke={D.ink} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** White mouse pointer (dark outline) gliding through [frame, x, y] points; dips and rings on clicks. */
export function DCursor({ points, clicks = [], start = 0 }: { points: [number, number, number][]; clicks?: number[]; start?: number }) {
  const frame = useCurrentFrame();
  const sounds = clicks.map((c) => <Sfx key={c} at={c} name="click" volume={0.9} />);
  if (frame < start) return <>{sounds}</>;
  const frames = points.map((p) => p[0]);
  const x = interpolate(frame, frames, points.map((p) => p[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const y = interpolate(frame, frames, points.map((p) => p[2]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const press = clicks.reduce((s, c) => Math.min(s, frame >= c && frame < c + 8 ? interpolate(frame, [c, c + 3, c + 8], [1, 0.8, 1]) : 1), 1);
  const ring = clicks.find((c) => frame >= c && frame < c + 16);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 50, pointerEvents: "none" }}>
      {sounds}
      {ring !== undefined && (
        <div
          style={{
            position: "absolute",
            left: -22,
            top: -22,
            width: 44,
            height: 44,
            borderRadius: 22,
            border: `2px solid ${D.ink}`,
            opacity: interpolate(frame, [ring, ring + 16], [0.6, 0]),
            transform: `scale(${interpolate(frame, [ring, ring + 16], [0.4, 1.3])})`,
          }}
        />
      )}
      <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `scale(${press})`, transformOrigin: "4px 3px", filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" }}>
        <path d="M4 3 L4 19 L8.5 14.8 L11.4 21 L14 19.8 L11.2 13.8 L17.5 13.6 Z" fill={D.ink} stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Dark browser window. Content area is width × (height − 52). */
export function DBrowser({ url, width = 1680, height = 860, style, children }: { url: string; width?: number; height?: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", width, height, background: D.bg, border: `1px solid ${D.line}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 50px 120px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.03)", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 18, padding: "0 18px", borderBottom: `1px solid ${D.line}`, background: D.panel }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: D.faint }} />
          ))}
        </div>
        <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", height: 32, borderRadius: 8, background: D.bg, border: `1px solid ${D.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: sans, fontSize: 15, color: D.muted }}>
          <Lock />
          {url}
        </div>
        <div style={{ width: 52 }} />
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

/** Desktop app window with a native-style title bar ("Stardoom AI", minimise / maximise / close). */
export function DAppWindow({ title = "Stardoom AI", width = 1680, height = 880, style, children }: { title?: string; width?: number; height?: number; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", width, height, background: D.bg, border: `1px solid ${D.line}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 50px 120px -30px rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ height: 40, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 0 0 16px", background: "#0a0a0c", borderBottom: `1px solid ${D.line}`, fontFamily: sans, fontSize: 14, color: D.muted }}>
        <DMark size={18} />
        {title}
        <div style={{ marginLeft: "auto", display: "flex", height: "100%" }}>
          {["—", "▢", "✕"].map((g) => (
            <div key={g} style={{ width: 52, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: D.muted }}>
              {g}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function Lock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.good} strokeWidth="2.4" strokeLinecap="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

/** Light button on dark (the landing's primary). */
export function DButton({ children, pressed = 0, ghost, style }: { children: React.ReactNode; pressed?: number; ghost?: boolean; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 50,
        padding: "0 24px",
        borderRadius: 8,
        background: ghost ? "transparent" : D.ink,
        border: `1px solid ${ghost ? "#52525b" : D.ink}`,
        color: ghost ? D.ink : "#000",
        fontFamily: sans,
        fontWeight: 700,
        fontSize: 16,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        transform: `scale(${1 - pressed * 0.04})`,
        opacity: 1 - pressed * 0.15,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Step caption, top-left: number, Orbitron title, subtitle. */
export function DCaption({ step, title, sub, start = 4 }: { step: string; title: string; sub: string; start?: number }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 120, top: 48, display: "flex", alignItems: "flex-end", gap: 28, zIndex: 20 }}>
      <div style={{ ...rise(frame, start), fontFamily: mono, fontWeight: 500, fontSize: 22, letterSpacing: "0.1em", color: D.subtle, paddingBottom: 8 }}>{step}</div>
      <div>
        <div style={{ ...rise(frame, start + 3), fontFamily: display, fontWeight: 800, fontSize: 44, letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1, color: D.ink }}>{title}</div>
        <div style={{ ...rise(frame, start + 8, 16), fontFamily: sans, fontSize: 22, color: D.muted, marginTop: 12 }}>{sub}</div>
      </div>
    </div>
  );
}

/**
 * The character: chrome mask (outer) with the hex-code face (inner) revealed in a soft spotlight
 * at (x, y) with radius r, both in composition pixels. Same falloff as the landing page.
 */
export function Character({ x, y, r, zoom = 1, style }: { x: number; y: number; r: number; zoom?: number; style?: React.CSSProperties }) {
  const mask = `radial-gradient(circle at ${x}px ${y}px, #000 0px, #000 ${r * 0.4}px, rgba(0,0,0,0.75) ${r * 0.6}px, rgba(0,0,0,0.4) ${r * 0.75}px, rgba(0,0,0,0.12) ${r * 0.88}px, transparent ${r}px)`;
  return (
    <AbsoluteFill style={{ transform: `scale(${zoom})`, ...style }}>
      <Img src={staticFile("stardoom-outer.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {r > 0 && (
        <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
          <Img src={staticFile("stardoom-inner.webp")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

/** End card shared by all videos: mark, wordmark, line, domain button, ticker + chain. */
export function EndCard({ line, start = 0 }: { line: string; start?: number }) {
  const frame = useCurrentFrame() - start;
  const s = ease(frame, [0, 18], [0.6, 1]);
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center" }}>
      <Sfx at={start + 2} name="pop" volume={0.6} />
      <Sfx at={start + 30} name="chime" volume={0.45} />
      <DGrid />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <DMark size={92} style={{ transform: `scale(${s})`, opacity: ease(frame, [0, 10], [0, 1]) }} />
        <DWordmark size={84} style={{ ...rise(frame, 6, 30), marginTop: 30 }} />
        <div style={{ ...rise(frame, 16, 16), marginTop: 22, fontFamily: sans, fontSize: 30, color: D.muted }}>{line}</div>
        <div style={{ ...rise(frame, 28, 16), display: "flex", gap: 18, marginTop: 48 }}>
          <DButton style={{ height: 66, padding: "0 36px", fontFamily: display, fontSize: 26, fontWeight: 800 }}>{DOMAIN.toUpperCase()}</DButton>
          <div style={{ height: 66, padding: "0 30px", display: "flex", alignItems: "center", gap: 14, borderRadius: 8, border: "1px solid #52525b", fontFamily: mono, fontSize: 24, color: D.ink }}>
            {TICKER}
            <span style={{ color: D.subtle, fontFamily: sans, fontSize: 20 }}>on Robinhood Chain</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Small "STARDOOM AI · stardoom.org" tag pinned to a corner of product scenes. */
export function Watermark() {
  return (
    <div style={{ position: "absolute", right: 120, top: 62, display: "flex", alignItems: "center", gap: 14, zIndex: 20, opacity: 0.9 }}>
      <DMark size={26} />
      <DWordmark size={20} />
    </div>
  );
}
