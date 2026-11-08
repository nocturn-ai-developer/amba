import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Sfx, TypingSound, display, ease, rise, sans, typed } from "../ui";
import { Character, D, DCheck, DGrid, DMark, DOMAIN, DWordmark, EndCard, TICKER, mono } from "./kit";

/** 30 s at 30 fps. The music drop lands at 7.5 s (frame 225), where the spotlight floods the character. */
export const INTRO_DURATION = 900;

const fadeOut = (frame: number, end: number, d = 12) => interpolate(frame, [end - d, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Mark drops in, the wordmark rises letter by letter, then the promise. */
function Logo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 13, mass: 0.8 } });
  const word = "STARDOOM AI";
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(frame, 110) }}>
      <Sfx at={2} name="pop" volume={0.7} />
      <Sfx at={44} name="chime" volume={0.4} />
      <DGrid opacity={ease(frame, [0, 30], [0, 1])} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <DMark size={120} style={{ transform: `scale(${mark}) rotate(${(1 - mark) * -30}deg)`, opacity: mark }} />
        <div style={{ display: "flex", marginTop: 40, fontFamily: display, fontWeight: 900, fontSize: 108, letterSpacing: "0.14em", color: D.ink }}>
          {word.split("").map((ch, i) => {
            const s = 12 + i * 2.5;
            return (
              <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: ease(frame, [s, s + 10], [0, 1]), transform: `translateY(${ease(frame, [s, s + 14], [40, 0])}px)` }}>
                {ch}
              </span>
            );
          })}
        </div>
        <div style={{ ...rise(frame, 50, 16), marginTop: 30, fontFamily: mono, fontSize: 24, letterSpacing: "0.3em", textTransform: "uppercase", color: D.muted }}>
          Build anything with AI
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** The landing hero: headline split around the character; the spotlight finds the code face, then floods at the drop. */
function Hero() {
  const frame = useCurrentFrame(); // scene starts at 100 in the video; drop at 225 → local 125
  const drop = 125;
  const r = interpolate(frame, [30, 60, drop - 6, drop + 18, 205, 240], [0, 300, 330, 2400, 2400, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(frame, [30, 70, drop], [900, 1010, 960], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y = interpolate(frame, [30, 70, drop], [330, 420, 380], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, 260], [1.12, 1]);
  const flash = interpolate(frame, [drop, drop + 3, drop + 14], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 14], [0, 1]) * fadeOut(frame, 260) }}>
      <Sfx at={28} name="swell" volume={0.5} />
      <Sfx at={drop} name="impact" volume={0.9} />
      <Character x={x} y={y} r={r} zoom={zoom} />
      <AbsoluteFill style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.85) 100%)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />

      <div style={{ position: "absolute", left: 110, top: 300 }}>
        <div style={{ ...rise(frame, 10, 14), fontFamily: mono, fontSize: 20, letterSpacing: "0.22em", color: D.muted, marginBottom: 18 }}>▲ AI APP BUILDER</div>
        {["BUILD", "ANYTHING"].map((l, i) => (
          <div key={l} style={{ overflow: "hidden" }}>
            <div style={{ fontFamily: display, fontWeight: 900, fontSize: 112, lineHeight: 1, letterSpacing: "0.06em", color: D.ink, transform: `translateY(${ease(frame, [12 + i * 6, 34 + i * 6], [110, 0])}%)` }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", right: 110, top: 300, textAlign: "right" }}>
        <div style={{ ...rise(frame, 22, 14), fontFamily: mono, fontSize: 20, letterSpacing: "0.22em", color: D.muted, marginBottom: 18 }}>WEB · WINDOWS · MACOS</div>
        {["WITH", "AI."].map((l, i) => (
          <div key={l} style={{ overflow: "hidden" }}>
            <div style={{ fontFamily: display, fontWeight: 900, fontSize: 112, lineHeight: 1, letterSpacing: "0.06em", color: D.ink, transform: `translateY(${ease(frame, [24 + i * 6, 46 + i * 6], [110, 0])}%)` }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, textAlign: "center", ...rise(frame, drop + 20, 20) }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 52, letterSpacing: "0.12em", color: D.ink }}>ANYONE CAN BUILD.</div>
        <div style={{ marginTop: 14, fontFamily: sans, fontSize: 26, color: D.muted }}>No code. No face. Just your idea.</div>
      </div>
    </AbsoluteFill>
  );
}

/** One of the three beats: mono step label, big Orbitron line, and a small product moment beneath. */
function Beat({ step, line, children }: { step: string; line: string; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: ease(frame, [0, 8], [0, 1]) * fadeOut(frame, 84, 8) }}>
      <Sfx at={0} name="whoosh" volume={0.35} />
      <DGrid opacity={0.7} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
        <div style={{ ...rise(frame, 2, 14), fontFamily: mono, fontSize: 24, letterSpacing: "0.3em", color: D.subtle }}>{step}</div>
        <div style={{ fontFamily: display, fontWeight: 900, fontSize: 96, letterSpacing: "0.08em", color: D.ink, transform: `scale(${ease(frame, [0, 16], [1.15, 1])})`, opacity: ease(frame, [0, 10], [0, 1]) }}>{line}</div>
        <div style={{ ...rise(frame, 12, 20) }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
}

function Describe() {
  const frame = useCurrentFrame();
  const text = "A landing page for my coffee shop, Bean There";
  return (
    <Beat step="01" line="DESCRIBE IT.">
      <TypingSound text={text} start={16} cps={34} volume={0.25} />
      <div style={{ width: 980, height: 84, display: "flex", alignItems: "center", gap: 16, padding: "0 12px 0 26px", borderRadius: 18, border: `1px solid ${D.line}`, background: D.panel, fontFamily: sans, fontSize: 30, color: D.ink }}>
        <span style={{ fontFamily: mono, color: D.subtle }}>&gt;</span>
        <span style={{ flex: 1 }}>{typed(text, frame, 16, 34)}</span>
        <div style={{ height: 58, padding: "0 24px", display: "flex", alignItems: "center", borderRadius: 12, background: D.ink, color: "#000", fontFamily: sans, fontWeight: 700, fontSize: 18, letterSpacing: "0.16em" }}>GENERATE ↗</div>
      </div>
    </Beat>
  );
}

function Builds() {
  const frame = useCurrentFrame();
  const files = ["src/App.tsx", "src/components/Hero.tsx", "src/components/Menu.tsx", "src/index.css"];
  return (
    <Beat step="02" line="AI BUILDS IT.">
      <div style={{ width: 760, display: "flex", flexDirection: "column", gap: 12, fontFamily: mono, fontSize: 24, color: D.muted }}>
        {files.map((f, i) => (
          <div key={f} style={{ ...rise(frame, 14 + i * 9, 12), display: "flex", alignItems: "center", gap: 14 }}>
            <Sfx at={20 + i * 9} name="tick" volume={0.35} />
            <DCheck size={22} />
            <span style={{ color: D.ink }}>Created</span> {f}
          </div>
        ))}
        <div style={{ ...rise(frame, 54, 12), display: "flex", alignItems: "center", gap: 14, marginTop: 8, color: D.good }}>
          <DCheck size={22} /> Build succeeded
        </div>
      </div>
    </Beat>
  );
}

function Live() {
  const frame = useCurrentFrame();
  return (
    <Beat step="03" line="LIVE ON ITS OWN DOMAIN.">
      <Sfx at={30} name="chime" volume={0.4} />
      <div style={{ display: "flex", alignItems: "center", gap: 18, height: 84, padding: "0 34px", borderRadius: 999, border: `1px solid ${D.line}`, background: D.panel, fontFamily: mono, fontSize: 32, color: D.ink }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: D.good, boxShadow: `0 0 ${ease(frame, [24, 40], [0, 20])}px ${D.good}` }} />
        https://beanthere.{DOMAIN}
        <span style={{ ...rise(frame, 30, 8), marginLeft: 8, fontFamily: sans, fontWeight: 700, fontSize: 18, letterSpacing: "0.16em", color: D.good }}>LIVE</span>
      </div>
    </Beat>
  );
}

/** Web and desktop side by side. */
function Everywhere() {
  const frame = useCurrentFrame();
  const card = (i: number, title: string, lines: string[]) => (
    <div style={{ ...rise(frame, 10 + i * 8, 30), position: "relative", width: 640, padding: "44px 48px", borderRadius: 18, border: `1px solid ${D.line}`, background: D.panel, display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontFamily: mono, fontSize: 20, letterSpacing: "0.24em", color: D.subtle }}>{i === 0 ? "WEB" : "DESKTOP"}</div>
      <div style={{ fontFamily: display, fontWeight: 800, fontSize: 46, letterSpacing: "0.06em", color: D.ink }}>{title}</div>
      {lines.map((l, k) => (
        <div key={l} style={{ ...rise(frame, 22 + i * 8 + k * 5, 10), display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontSize: 26, color: D.muted }}>
          <DCheck size={22} /> {l}
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 150) }}>
      <Sfx at={0} name="whoosh" volume={0.35} />
      <DGrid opacity={0.7} />
      <div style={{ position: "absolute", top: 150, fontFamily: display, fontWeight: 900, fontSize: 64, letterSpacing: "0.1em", color: D.ink, ...rise(frame, 0, 20) }}>WEB + DESKTOP</div>
      <div style={{ display: "flex", gap: 48, marginTop: 90 }}>
        {card(0, DOMAIN, ["Sign in and build in the browser", "Bring your own Anthropic key", "Deploy to your own subdomain"])}
        {card(1, "Windows · macOS", ["Runs on your computer", "Local AI: Ollama, LM Studio", "Export or publish in one click"])}
      </div>
    </AbsoluteFill>
  );
}

/** The ticker, big. */
function Token() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(frame, 70, 10) }}>
      <Sfx at={0} name="impact" volume={0.6} />
      <DGrid opacity={0.6} />
      <div style={{ fontFamily: mono, fontSize: 26, letterSpacing: "0.3em", color: D.subtle, ...rise(frame, 4, 12) }}>THE TOKEN</div>
      <div style={{ marginTop: 24, fontFamily: display, fontWeight: 900, fontSize: 170, letterSpacing: "0.04em", color: D.ink, transform: `scale(${ease(frame, [0, 20], [1.25, 1])})`, opacity: ease(frame, [0, 8], [0, 1]) }}>{TICKER}</div>
      <div style={{ marginTop: 26, fontFamily: sans, fontSize: 34, color: D.muted, ...rise(frame, 14, 16) }}>on Robinhood Chain</div>
    </AbsoluteFill>
  );
}

export function StardoomIntro() {
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <Html5Audio src={staticFile("sfx/stardoom-intro.wav")} volume={0.55} />
      <Sequence durationInFrames={110}>
        <Logo />
      </Sequence>
      <Sequence from={100} durationInFrames={262}>
        <Hero />
      </Sequence>
      <Sequence from={360} durationInFrames={86}>
        <Describe />
      </Sequence>
      <Sequence from={440} durationInFrames={86}>
        <Builds />
      </Sequence>
      <Sequence from={520} durationInFrames={86}>
        <Live />
      </Sequence>
      <Sequence from={600} durationInFrames={152}>
        <Everywhere />
      </Sequence>
      <Sequence from={750} durationInFrames={72}>
        <Token />
      </Sequence>
      <Sequence from={815} durationInFrames={85}>
        <EndCard line="Build anything with AI." />
      </Sequence>
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <DWordmarkCorner />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Small corner wordmark during the middle of the video (hidden on the logo and end cards). */
function DWordmarkCorner() {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [360, 372, 740, 750], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 60, bottom: 50, display: "flex", alignItems: "center", gap: 12, opacity: o }}>
      <DMark size={24} />
      <DWordmark size={18} />
    </div>
  );
}
