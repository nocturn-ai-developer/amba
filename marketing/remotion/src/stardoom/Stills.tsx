import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { display, sans } from "../ui";
import { D, DCheck, DGrid, DMark, DOMAIN, DWordmark, HANDLE, TICKER, mono } from "./kit";

const OUTER = staticFile("stardoom-outer.webp");
const INNER = staticFile("stardoom-inner.webp");
const IMG_W = 1984;
const IMG_H = 1116;

/** X profile picture (render 1000×1000; X shows it as a circle). The masked face in its hood. */
export function XProfile() {
  const scale = 1.5;
  const w = IMG_W * scale;
  const h = IMG_H * scale;
  // Centre of the hood in the source image, so it sits in the middle of the circle.
  const cx = 992 * scale;
  const cy = 335 * scale;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Img src={OUTER} style={{ position: "absolute", width: w, height: h, left: 500 - cx, top: 500 - cy }} />
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 75%)" }} />
    </AbsoluteFill>
  );
}

function Chip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{ height: 44, padding: "0 18px", display: "flex", alignItems: "center", gap: 10, borderRadius: 999, border: `1px solid ${strong ? D.ink : "#3f3f46"}`, background: strong ? D.ink : "rgba(0,0,0,0.5)", color: strong ? "#000" : D.ink, fontFamily: mono, fontSize: 18, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

/** X header banner (render 1500×500 at scale 2). The avatar covers the bottom-left, so the copy sits centre-left. */
export function XBanner() {
  const h = 560;
  const w = (IMG_W / IMG_H) * h;
  return (
    <AbsoluteFill style={{ background: D.bg, overflow: "hidden" }}>
      <DGrid opacity={0.8} size={48} drift={0} />
      <Img src={OUTER} style={{ position: "absolute", height: h, width: w, right: -120, top: -18 }} />
      <AbsoluteFill style={{ background: "linear-gradient(to right, #050506 0%, #050506 38%, rgba(5,5,6,0.6) 52%, rgba(5,5,6,0) 64%)" }} />
      <div style={{ position: "absolute", left: 230, top: 120, display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <DMark size={58} />
          <DWordmark size={60} />
        </div>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 30, letterSpacing: "0.14em", color: D.ink }}>BUILD ANYTHING WITH AI</div>
        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
          <Chip strong>{TICKER}</Chip>
          <Chip>Robinhood Chain</Chip>
          <Chip>{DOMAIN}</Chip>
        </div>
      </div>
      <div style={{ position: "absolute", left: 232, top: 372, fontFamily: mono, fontSize: 16, letterSpacing: "0.22em", color: D.subtle }}>WEB · WINDOWS · MACOS</div>
    </AbsoluteFill>
  );
}

/** Post image 1 (1600×900): the launch announcement, the face split between mask and code. */
export function PostIntroducing() {
  const split = "linear-gradient(to right, transparent 0%, transparent 49.2%, #000 50.8%, #000 100%)";
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <Img src={OUTER} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <AbsoluteFill style={{ maskImage: split, WebkitMaskImage: split }}>
        <Img src={INNER} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: "50%", top: 60, bottom: 230, width: 1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.7), transparent)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 22%, rgba(0,0,0,0) 42%)" }} />

      <div style={{ position: "absolute", left: 70, top: 64, display: "flex", alignItems: "center", gap: 14 }}>
        <DMark size={34} />
        <DWordmark size={28} />
      </div>
      <div style={{ position: "absolute", right: 70, top: 72, fontFamily: mono, fontSize: 18, letterSpacing: "0.24em", color: D.muted }}>NOW LIVE</div>
      <div style={{ position: "absolute", left: 70, top: 260, width: 470 }}>
        <div style={{ fontFamily: mono, fontSize: 18, letterSpacing: "0.26em", color: D.muted }}>INTRODUCING</div>
        <div style={{ marginTop: 12, fontFamily: display, fontWeight: 900, fontSize: 74, lineHeight: 1, letterSpacing: "0.05em", color: D.ink }}>
          STARDOOM
          <br />
          AI
        </div>
      </div>
      <div style={{ position: "absolute", right: 70, top: 260, width: 430, textAlign: "right", fontFamily: sans, fontSize: 26, lineHeight: 1.45, color: D.muted }}>
        The face of the builder doesn&apos;t matter.
        <br />
        <span style={{ color: D.ink }}>The idea does.</span>
      </div>

      <div style={{ position: "absolute", left: 70, right: 70, bottom: 60, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 40 }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 36, lineHeight: 1.25, letterSpacing: "0.06em", color: D.ink }}>
          DESCRIBE IT. AI BUILDS IT.
          <br />
          LIVE ON ITS OWN DOMAIN.
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Chip strong>{TICKER}</Chip>
          <Chip>Robinhood Chain</Chip>
          <Chip>{DOMAIN}</Chip>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Post image 2 (1600×900): the token and the four steps from idea to token. */
export function PostToken() {
  const steps = [
    ["01", "Describe it", "One sentence, plain words."],
    ["02", "AI builds it", "Real code, built and checked."],
    ["03", "Go live", `your-app.${DOMAIN}`],
    ["04", "Launch its token", "On Robinhood Chain, from the app."],
  ];
  const reveal = "radial-gradient(circle at 800px 300px, #000 0px, #000 95px, rgba(0,0,0,0.6) 150px, transparent 205px)";
  return (
    <AbsoluteFill style={{ background: D.bg, overflow: "hidden" }}>
      <DGrid opacity={0.7} size={56} drift={0} />
      {/* Character on the right, the code face showing through a spotlight. */}
      <div style={{ position: "absolute", right: -260, top: 0, width: 1600, height: 900 }}>
        <Img src={OUTER} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, maskImage: reveal, WebkitMaskImage: reveal }}>
          <Img src={INNER} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      </div>
      <AbsoluteFill style={{ background: "linear-gradient(to right, #050506 0%, #050506 44%, rgba(5,5,6,0.7) 56%, rgba(5,5,6,0) 70%)" }} />

      <div style={{ position: "absolute", left: 80, top: 70, display: "flex", alignItems: "center", gap: 14 }}>
        <DMark size={34} />
        <DWordmark size={28} />
      </div>
      <div style={{ position: "absolute", left: 80, top: 190 }}>
        <div style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.28em", color: D.muted }}>THE TOKEN</div>
        <div style={{ marginTop: 10, fontFamily: display, fontWeight: 900, fontSize: 96, letterSpacing: "0.02em", color: D.ink, lineHeight: 1 }}>{TICKER}</div>
        <div style={{ marginTop: 14, fontFamily: sans, fontSize: 30, color: D.muted }}>on Robinhood Chain</div>
      </div>
      <div style={{ position: "absolute", left: 80, top: 470, width: 820, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {steps.map(([n, t, s]) => (
          <div key={n} style={{ padding: "20px 22px", borderRadius: 16, border: `1px solid ${D.line}`, background: "rgba(14,14,17,0.85)", display: "flex", gap: 16 }}>
            <div style={{ fontFamily: mono, fontSize: 18, color: D.subtle, paddingTop: 4 }}>{n}</div>
            <div>
              <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 24, color: D.ink }}>{t}</div>
              <div style={{ marginTop: 4, fontFamily: n === "03" ? mono : sans, fontSize: 18, color: D.muted }}>{s}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 56, display: "flex", alignItems: "center", gap: 26, fontFamily: mono, fontSize: 20, color: D.muted }}>
        <span style={{ color: D.ink }}>{DOMAIN}</span>
        <span>{HANDLE}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <DCheck size={18} /> Web · Windows · macOS
        </span>
      </div>
    </AbsoluteFill>
  );
}
