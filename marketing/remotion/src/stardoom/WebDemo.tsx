import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Sfx, TypingSound, display, ease, rise, sans, typed } from "../ui";
import { D, DBrowser, DButton, DCaption, DCheck, DCursor, DGrid, DMark, DOMAIN, DSpinner, EndCard, Watermark, mono } from "./kit";

export const WEB_DEMO_DURATION = 900;

const fadeOut = (frame: number, end: number, d = 12) => interpolate(frame, [end - d, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Window placement shared by the product scenes. */
const WIN = { left: 120, top: 170, width: 1680, height: 860 };

function Title() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(frame, 80) }}>
      <Sfx at={2} name="pop" volume={0.6} />
      <DGrid opacity={ease(frame, [0, 20], [0, 1])} />
      <DMark size={84} style={{ opacity: ease(frame, [0, 10], [0, 1]), transform: `scale(${ease(frame, [0, 18], [0.6, 1])})` }} />
      <div style={{ ...rise(frame, 6, 24), marginTop: 30, fontFamily: mono, fontSize: 26, letterSpacing: "0.32em", color: D.subtle }}>DEMO · WEB</div>
      <div style={{ ...rise(frame, 12, 24), marginTop: 16, fontFamily: display, fontWeight: 900, fontSize: 92, letterSpacing: "0.08em", color: D.ink }}>{DOMAIN.toUpperCase()}</div>
      <div style={{ ...rise(frame, 22, 16), marginTop: 20, fontFamily: sans, fontSize: 28, color: D.muted }}>From one sentence to a live website in under a minute.</div>
    </AbsoluteFill>
  );
}

/** Dashboard: type the idea, press Generate. */
function Prompt() {
  const frame = useCurrentFrame();
  const text = "A landing page for my coffee shop, Bean There. Warm and minimal.";
  const typeStart = 34;
  const clickAt = 196;
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 240) }}>
      <DGrid opacity={0.5} />
      <DCaption step="01" title="Describe it" sub="Type your idea in plain words." />
      <Watermark />
      <DBrowser url={`${DOMAIN}/dashboard`} {...WIN} style={{ left: WIN.left, top: WIN.top, ...rise(frame, 4, 40) }}>
        <div style={{ position: "absolute", inset: 0, padding: "70px 90px" }}>
          <div style={{ fontFamily: mono, fontSize: 16, letterSpacing: "0.22em", color: D.subtle }}>GOOD MORNING</div>
          <div style={{ marginTop: 18, fontFamily: display, fontWeight: 900, fontSize: 74, letterSpacing: "0.06em", lineHeight: 1.05, color: D.ink }}>
            WHAT ARE WE
            <br />
            MAKING TODAY?
          </div>
          <TypingSound text={text} start={typeStart} cps={30} volume={0.25} />
          <div style={{ marginTop: 48, width: 1100, height: 80, display: "flex", alignItems: "center", gap: 16, padding: "0 12px 0 26px", borderRadius: 16, border: `1px solid ${frame > typeStart ? "#52525b" : D.line}`, background: D.panel, fontFamily: sans, fontSize: 26, color: D.ink }}>
            <span style={{ fontFamily: mono, color: D.subtle }}>&gt;</span>
            <span style={{ flex: 1, color: frame < typeStart ? D.subtle : D.ink }}>{frame < typeStart ? "A booking page for my pottery studio…" : typed(text, frame, typeStart, 30)}</span>
            <DButton pressed={interpolate(frame, [clickAt, clickAt + 3, clickAt + 9], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>Generate ↗</DButton>
          </div>
          <div style={{ marginTop: 40, display: "flex", gap: 22 }}>
            {["Portfolio", "Coffee shop menu", "Meme coin landing page", "Habit tracker"].map((t) => (
              <div key={t} style={{ padding: "10px 18px", borderRadius: 999, border: `1px solid ${D.line}`, fontFamily: sans, fontSize: 18, color: D.muted }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </DBrowser>
      <DCursor start={150} points={[[150, 1500, 900], [190, 1215, 575]]} clicks={[clickAt]} />
    </AbsoluteFill>
  );
}

/** The coffee site preview, drawn progressively; `dark` crossfades to the requested restyle. */
function CoffeeSite({ progress, dark }: { progress: number; dark: number }) {
  const bg = mix("#f6efe6", "#0f0d0b", dark);
  const ink = mix("#2b1d14", "#f3e9d8", dark);
  const accent = mix("#8a5a3b", "#d4a64a", dark);
  const card = mix("#ffffff", "#1a1714", dark);
  const show = (at: number) => ({ opacity: interpolate(progress, [at, at + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: `translateY(${interpolate(progress, [at, at + 0.12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` });
  return (
    <div style={{ position: "absolute", inset: 0, background: bg, fontFamily: sans, color: ink, padding: "26px 40px", overflow: "hidden" }}>
      <div style={{ ...show(0.05), display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16 }}>
        <span style={{ fontFamily: display, fontWeight: 800, letterSpacing: "0.12em", fontSize: 20 }}>BEAN THERE</span>
        <span style={{ display: "flex", gap: 22, opacity: 0.75 }}>
          <span>Menu</span>
          <span>Visit</span>
          <span style={{ color: accent, fontWeight: 700 }}>Order</span>
        </span>
      </div>
      <div style={{ ...show(0.2), marginTop: 56, fontSize: 56, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
        Slow coffee,
        <br />
        fast mornings.
      </div>
      <div style={{ ...show(0.32), marginTop: 16, fontSize: 18, opacity: 0.75, maxWidth: 440 }}>Single-origin beans roasted on Elm Street since 2016. Come in, sit down, stay a while.</div>
      <div style={{ ...show(0.42), marginTop: 26, display: "inline-flex", padding: "12px 22px", borderRadius: 999, background: accent, color: mix("#fff", "#0f0d0b", dark), fontWeight: 700, fontSize: 16 }}>See the menu</div>
      <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {[
          ["Flat white", "$4.20"],
          ["Pour over", "$5.00"],
          ["Cardamom bun", "$3.80"],
        ].map(([n, p], i) => (
          <div key={n} style={{ ...show(0.55 + i * 0.1), background: card, borderRadius: 14, padding: 18, boxShadow: "0 8px 20px -12px rgba(0,0,0,0.3)" }}>
            <div style={{ height: 70, borderRadius: 10, background: `linear-gradient(135deg, ${accent}, ${mix("#d9c3a6", "#3a2e22", dark)})`, opacity: 0.85 }} />
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 600 }}>
              <span>{n}</span>
              <span style={{ color: accent }}>{p}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

type Activity = { at: number; label: string; done: number };

/** Builder: chat on the left with the agent's steps, live preview on the right. */
function Builder({ messages, activity, progress, dark, caption }: { messages: { at: number; who: "you" | "ai"; text: string }[]; activity: Activity[]; progress: number; dark: number; caption: React.ReactNode }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <DGrid opacity={0.5} />
      {caption}
      <Watermark />
      <DBrowser url={`${DOMAIN}/project/bean-there`} {...WIN} style={{ left: WIN.left, top: WIN.top }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "520px 1fr" }}>
          <div style={{ borderRight: `1px solid ${D.line}`, padding: 26, display: "flex", flexDirection: "column", gap: 16, fontFamily: sans }}>
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.2em", color: D.subtle }}>AI CHAT</div>
            {messages
              .filter((m) => frame >= m.at)
              .map((m) => (
                <div key={m.at} style={{ ...rise(frame, m.at, 10), alignSelf: m.who === "you" ? "flex-end" : "flex-start", maxWidth: 420, padding: "12px 16px", borderRadius: 14, background: m.who === "you" ? D.panel2 : "transparent", border: m.who === "you" ? "none" : `1px solid ${D.line}`, fontSize: 18, lineHeight: 1.45, color: D.ink }}>
                  {m.text}
                </div>
              ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              {activity
                .filter((a) => frame >= a.at)
                .map((a) => (
                  <div key={a.label} style={{ ...rise(frame, a.at, 8), display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontSize: 16, color: frame >= a.done ? D.muted : D.ink }}>
                    {frame >= a.done ? <DCheck size={18} /> : <DSpinner size={18} />}
                    {a.label}
                  </div>
                ))}
            </div>
          </div>
          <div style={{ position: "relative", background: D.panel, padding: 22 }}>
            <div style={{ position: "relative", height: "100%", borderRadius: 12, overflow: "hidden", border: `1px solid ${D.line}` }}>
              {progress <= 0 ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: sans, fontSize: 20, color: D.subtle }}>
                  <DSpinner size={22} /> Building your app…
                </div>
              ) : (
                <CoffeeSite progress={progress} dark={dark} />
              )}
            </div>
          </div>
        </div>
      </DBrowser>
    </AbsoluteFill>
  );
}

const FIRST_ASK = "A landing page for my coffee shop, Bean There. Warm and minimal.";

function Build() {
  const frame = useCurrentFrame();
  const files: Activity[] = [
    { at: 30, label: "Created src/App.tsx", done: 52 },
    { at: 52, label: "Created src/components/Hero.tsx", done: 74 },
    { at: 74, label: "Created src/components/Menu.tsx", done: 96 },
    { at: 96, label: "Build succeeded", done: 118 },
  ];
  return (
    <AbsoluteFill style={{ opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 270) }}>
      {files.map((f) => (
        <Sfx key={f.label} at={f.done} name="tick" volume={0.35} />
      ))}
      <Sfx at={120} name="chime" volume={0.35} />
      <Builder
        messages={[
          { at: 0, who: "you", text: FIRST_ASK },
          { at: 130, who: "ai", text: "Built a warm one-page site with a hero, your story and a menu with prices." },
        ]}
        activity={files}
        progress={interpolate(frame, [100, 230], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        dark={0}
        caption={<DCaption step="02" title="AI builds it" sub="Real code, checked and built for you." />}
      />
    </AbsoluteFill>
  );
}

function Change() {
  const frame = useCurrentFrame();
  const ask = "Make it dark with gold accents";
  return (
    <AbsoluteFill style={{ opacity: fadeOut(frame, 160) }}>
      <TypingSound text={ask} start={10} cps={34} volume={0.22} />
      <Sfx at={88} name="tick" volume={0.35} />
      <Sfx at={92} name="swell" volume={0.35} />
      <Builder
        messages={[
          { at: -100, who: "you", text: FIRST_ASK },
          { at: -100, who: "ai", text: "Built a warm one-page site with a hero, your story and a menu with prices." },
          { at: 34, who: "you", text: ask },
        ]}
        activity={[{ at: 46, label: "Edited src/index.css", done: 88 }]}
        progress={1}
        dark={interpolate(frame, [90, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        caption={<DCaption step="03" title="Change anything" sub="Just ask. The preview updates." />}
      />
      <div style={{ position: "absolute", left: WIN.left + 26, top: WIN.top + 52 + 700, width: 468, height: 60, display: "flex", alignItems: "center", padding: "0 16px", borderRadius: 12, border: "1px solid #52525b", background: D.panel, fontFamily: sans, fontSize: 18, color: D.ink, opacity: interpolate(frame, [30, 38], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        {typed(ask, frame, 10, 34)}
      </div>
    </AbsoluteFill>
  );
}

/** Deploy dialog: three checks, then the live URL. */
function Deploy() {
  const frame = useCurrentFrame();
  const steps = ["Build successful", "Container started", "Domain configured"];
  const clickAt = 22;
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 8], [0, 1]) * fadeOut(frame, 130) }}>
      <DGrid opacity={0.5} />
      <DCaption step="04" title="Deploy" sub="One click. Live with HTTPS on its own subdomain." />
      <Watermark />
      <div style={{ position: "absolute", left: 560, top: 260, width: 800, padding: 44, borderRadius: 18, border: `1px solid ${D.line}`, background: D.panel, boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)", ...rise(frame, 0, 30) }}>
        <div style={{ fontFamily: display, fontWeight: 800, fontSize: 34, letterSpacing: "0.08em", color: D.ink }}>DEPLOY</div>
        <div style={{ marginTop: 10, fontFamily: mono, fontSize: 22, color: D.muted }}>beanthere.{DOMAIN}</div>
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 16 }}>
          {steps.map((s, i) => {
            const at = 34 + i * 16;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontSize: 22, color: frame >= at ? D.ink : D.subtle }}>
                <Sfx at={at} name="tick" volume={0.35} />
                {frame >= at ? <DCheck size={22} /> : <DSpinner size={22} />} {s}
              </div>
            );
          })}
        </div>
        <div style={{ ...rise(frame, 86, 12), marginTop: 32, display: "flex", alignItems: "center", gap: 14, height: 64, padding: "0 22px", borderRadius: 12, background: "rgba(134,239,172,0.08)", border: "1px solid rgba(134,239,172,0.35)", fontFamily: mono, fontSize: 22, color: D.good }}>
          <Sfx at={86} name="chime" volume={0.4} />
          ● Live at https://beanthere.{DOMAIN}
        </div>
        <DButton pressed={interpolate(frame, [clickAt, clickAt + 3, clickAt + 9], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} style={{ position: "absolute", right: 44, top: 44, height: 46 }}>
          Deploy
        </DButton>
      </div>
      <DCursor points={[[0, 1500, 700], [18, 1272, 330]]} clicks={[clickAt]} />
    </AbsoluteFill>
  );
}

export function StardoomWebDemo() {
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <Html5Audio src={staticFile("sfx/stardoom-web.wav")} volume={0.5} />
      <Sequence durationInFrames={80}>
        <Title />
      </Sequence>
      <Sequence from={72} durationInFrames={240}>
        <Prompt />
      </Sequence>
      <Sequence from={306} durationInFrames={270}>
        <Build />
      </Sequence>
      <Sequence from={570} durationInFrames={160}>
        <Change />
      </Sequence>
      <Sequence from={724} durationInFrames={130}>
        <Deploy />
      </Sequence>
      <Sequence from={846} durationInFrames={54}>
        <EndCardShort />
      </Sequence>
    </AbsoluteFill>
  );
}

/** A quicker end card (the web demo ends on the deploy). */
function EndCardShort() {
  return <EndCard line="Describe it. AI builds it. Live on its own domain." />;
}

