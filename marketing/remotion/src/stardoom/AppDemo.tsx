import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Sfx, TypingSound, display, ease, rise, sans, typed } from "../ui";
import { D, DAppWindow, DButton, DCaption, DCheck, DCursor, DGrid, DMark, DOMAIN, DSpinner, EndCard, Watermark, mono } from "./kit";

export const APP_DEMO_DURATION = 900;

const fadeOut = (frame: number, end: number, d = 12) => interpolate(frame, [end - d, end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const press = (frame: number, at: number) => interpolate(frame, [at, at + 3, at + 9], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const WIN = { left: 120, top: 170, width: 1680, height: 860 };
/** Content origin inside the app window (below the 40 px title bar). */
const OX = WIN.left;
const OY = WIN.top + 40;

function Title() {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: D.bg, alignItems: "center", justifyContent: "center", opacity: fadeOut(frame, 80) }}>
      <Sfx at={2} name="pop" volume={0.6} />
      <DGrid opacity={ease(frame, [0, 20], [0, 1])} />
      <DMark size={84} style={{ opacity: ease(frame, [0, 10], [0, 1]), transform: `scale(${ease(frame, [0, 18], [0.6, 1])})` }} />
      <div style={{ ...rise(frame, 6, 24), marginTop: 30, fontFamily: mono, fontSize: 26, letterSpacing: "0.32em", color: D.subtle }}>DEMO · DESKTOP APP</div>
      <div style={{ ...rise(frame, 12, 24), marginTop: 16, fontFamily: display, fontWeight: 900, fontSize: 92, letterSpacing: "0.08em", color: D.ink }}>WINDOWS · MACOS</div>
      <div style={{ ...rise(frame, 22, 16), marginTop: 20, fontFamily: sans, fontSize: 28, color: D.muted }}>Build on your own computer. Your key, or a local AI.</div>
    </AbsoluteFill>
  );
}

/** Settings: pick Ollama, choose a model, connected. */
function Provider() {
  const frame = useCurrentFrame();
  const clickOllama = 60;
  const clickSave = 150;
  const chosen = frame >= clickOllama;
  const cards = [
    ["Claude", "Your Anthropic key"],
    ["Ollama", "Local, free"],
    ["LM Studio", "Local, free"],
    ["Custom", "Any OpenAI-compatible URL"],
  ];
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 220) }}>
      <DGrid opacity={0.5} />
      <DCaption step="01" title="Pick your AI" sub="Bring your own key, or run a model on this computer." />
      <Watermark />
      <DAppWindow {...WIN} style={{ left: WIN.left, top: WIN.top, ...rise(frame, 4, 40) }}>
        <div style={{ position: "absolute", inset: 0, padding: "56px 90px", fontFamily: sans }}>
          <div style={{ fontFamily: mono, fontSize: 15, letterSpacing: "0.22em", color: D.subtle }}>SETTINGS</div>
          <div style={{ marginTop: 12, fontFamily: display, fontWeight: 900, fontSize: 56, letterSpacing: "0.06em", color: D.ink }}>AI &amp; PUBLISHING</div>
          <div style={{ marginTop: 40, fontFamily: mono, fontSize: 14, letterSpacing: "0.2em", color: D.subtle }}>AI PROVIDER</div>
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {cards.map(([t, s], i) => {
              const active = chosen ? i === 1 : i === 0;
              return (
                <div key={t} style={{ padding: "20px 22px", borderRadius: 16, border: `1px solid ${active ? D.ink : D.line}`, background: active ? D.panel2 : "transparent" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: D.ink }}>{t}</div>
                  <div style={{ fontSize: 16, color: D.muted, marginTop: 4 }}>{s}</div>
                  {i === 1 && frame >= clickSave + 14 && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", color: D.good }}>IN USE</div>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, opacity: ease(frame, [clickOllama, clickOllama + 12], [0.25, 1]) }}>
            <Field label="Endpoint URL" value="http://127.0.0.1:11434/v1" />
            <Field label="Model" value={frame >= 100 ? "qwen2.5-coder:14b" : "Loading models…"} />
          </div>
          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 22 }}>
            <DButton pressed={press(frame, clickSave)}>Use Ollama</DButton>
            {frame >= clickSave + 14 && (
              <div style={{ ...rise(frame, clickSave + 14, 8), display: "flex", alignItems: "center", gap: 10, fontSize: 20, color: D.good }}>
                <Sfx at={clickSave + 14} name="chime" volume={0.35} />
                <DCheck size={20} /> Connected. Using qwen2.5-coder:14b.
              </div>
            )}
          </div>
        </div>
      </DAppWindow>
      <DCursor start={30} points={[[30, 1400, 900], [56, 690, 470], [120, 690, 470], [146, 330, 750]]} clicks={[clickOllama, clickSave]} />
    </AbsoluteFill>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: sans, fontSize: 15, color: D.muted }}>{label}</div>
      <div style={{ marginTop: 8, height: 54, display: "flex", alignItems: "center", padding: "0 18px", borderRadius: 10, border: `1px solid ${D.line}`, background: D.panel, fontFamily: mono, fontSize: 20, color: D.ink }}>{value}</div>
    </div>
  );
}

/** A small habit tracker (the app being built), drawn progressively. */
function HabitApp({ progress }: { progress: number }) {
  const show = (at: number) => ({ opacity: interpolate(progress, [at, at + 0.12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: `translateY(${interpolate(progress, [at, at + 0.12], [14, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` });
  const habits = [
    ["Read 20 pages", 12],
    ["Morning run", 7],
    ["No sugar", 4],
  ] as const;
  return (
    <div style={{ position: "absolute", inset: 0, background: "#f7f7f5", fontFamily: sans, color: "#111", padding: "30px 40px" }}>
      <div style={{ ...show(0.05), display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>Streaks</span>
        <span style={{ fontSize: 16, color: "#666" }}>Thursday, 7 Nov</span>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
        {habits.map(([name, streak], i) => (
          <div key={name} style={{ ...show(0.2 + i * 0.15), background: "#fff", borderRadius: 16, padding: "18px 22px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 6px 18px -12px rgba(0,0,0,0.25)" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: i < 2 ? "#16a34a" : "#e5e5e5", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 }}>{i < 2 ? "✓" : ""}</div>
            <div style={{ flex: 1, fontSize: 20, fontWeight: 600 }}>{name}</div>
            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: 14 }, (_, k) => (
                <span key={k} style={{ width: 12, height: 26, borderRadius: 3, background: k < streak ? "#16a34a" : "#e5e5e5", opacity: k < streak ? 0.35 + (k / 14) * 0.65 : 1 }} />
              ))}
            </div>
            <div style={{ width: 70, textAlign: "right", fontSize: 18, fontWeight: 800 }}>🔥 {streak}</div>
          </div>
        ))}
      </div>
      <div style={{ ...show(0.75), marginTop: 22, display: "inline-flex", padding: "12px 20px", borderRadius: 999, background: "#111", color: "#fff", fontWeight: 700, fontSize: 16 }}>+ New habit</div>
    </div>
  );
}

/** Builder: prompt, local build steps, preview on 127.0.0.1. */
function LocalBuild() {
  const frame = useCurrentFrame();
  const ask = "A habit tracker with streaks";
  const steps = [
    { at: 70, label: "Created src/App.tsx", done: 92 },
    { at: 92, label: "Created src/components/HabitRow.tsx", done: 114 },
    { at: 114, label: "Building on this computer (no Docker)", done: 150 },
    { at: 150, label: "Preview ready", done: 158 },
  ];
  const progress = interpolate(frame, [152, 240], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 260) }}>
      <DGrid opacity={0.5} />
      <DCaption step="02" title="Builds on your machine" sub="Code and preview stay on your computer." />
      <Watermark />
      <TypingSound text={ask} start={14} cps={30} volume={0.22} />
      {steps.map((s) => (
        <Sfx key={s.label} at={s.done} name="tick" volume={0.35} />
      ))}
      <DAppWindow {...WIN} style={{ left: WIN.left, top: WIN.top }}>
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "520px 1fr" }}>
          <div style={{ borderRight: `1px solid ${D.line}`, padding: 26, display: "flex", flexDirection: "column", gap: 16, fontFamily: sans }}>
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.2em", color: D.subtle }}>AI CHAT · qwen2.5-coder (local)</div>
            {frame >= 56 && <div style={{ ...rise(frame, 56, 10), alignSelf: "flex-end", padding: "12px 16px", borderRadius: 14, background: D.panel2, fontSize: 18, color: D.ink }}>{ask}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {steps
                .filter((s) => frame >= s.at)
                .map((s) => (
                  <div key={s.label} style={{ ...rise(frame, s.at, 8), display: "flex", alignItems: "center", gap: 12, fontFamily: mono, fontSize: 16, color: frame >= s.done ? D.muted : D.ink }}>
                    {frame >= s.done ? <DCheck size={18} /> : <DSpinner size={18} />}
                    {s.label}
                  </div>
                ))}
            </div>
            <div style={{ marginTop: "auto", height: 60, display: "flex", alignItems: "center", padding: "0 16px", borderRadius: 12, border: `1px solid ${frame < 56 ? "#52525b" : D.line}`, background: D.panel, fontSize: 18, color: D.ink }}>
              {frame < 56 ? typed(ask, frame, 14, 30) : <span style={{ color: D.subtle }}>Ask the AI to change anything…</span>}
            </div>
          </div>
          <div style={{ position: "relative", background: D.panel, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px solid ${D.line}`, fontFamily: mono, fontSize: 15, color: D.muted }}>http://127.0.0.1:5173</div>
            <div style={{ position: "relative", flex: 1, borderRadius: 12, overflow: "hidden", border: `1px solid ${D.line}` }}>
              {progress <= 0 ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: sans, fontSize: 20, color: D.subtle }}>
                  {frame > 56 && <DSpinner size={22} />} {frame > 56 ? "Building locally…" : "Preview appears here"}
                </div>
              ) : (
                <HabitApp progress={progress} />
              )}
            </div>
          </div>
        </div>
      </DAppWindow>
    </AbsoluteFill>
  );
}

/** Export (zip) and Publish (live on stardoom.org). */
function Ship() {
  const frame = useCurrentFrame();
  const clickExport = 30;
  const clickPublish = 96;
  return (
    <AbsoluteFill style={{ background: D.bg, opacity: ease(frame, [0, 10], [0, 1]) * fadeOut(frame, 200) }}>
      <DGrid opacity={0.5} />
      <DCaption step="03" title="Export or publish" sub="Download the code, or put it online in one click." />
      <Watermark />
      <DAppWindow {...WIN} style={{ left: WIN.left, top: WIN.top }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 64, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", borderBottom: `1px solid ${D.line}`, fontFamily: sans }}>
          <DMark size={22} />
          <span style={{ fontWeight: 700, letterSpacing: "0.12em", color: D.ink }}>HABIT TRACKER</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
            <DButton ghost pressed={press(frame, clickExport)} style={{ height: 44, fontSize: 14 }}>⤓ Export</DButton>
            <DButton pressed={press(frame, clickPublish)} style={{ height: 44, fontSize: 14 }}>
              {frame >= clickPublish && frame < clickPublish + 50 ? <DSpinner size={16} /> : "◎"} {frame >= clickPublish + 50 ? "Republish" : "Publish"}
            </DButton>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, opacity: 0.35 }}>
          <HabitApp progress={1} />
        </div>
      </DAppWindow>

      {frame >= clickExport + 8 && (
        <Toast at={clickExport + 8} icon="⤓" title="habit-tracker.zip" sub="Source + built site, saved to Downloads" top={300} />
      )}
      {frame >= clickPublish + 50 && (
        <Toast at={clickPublish + 50} icon="●" title="Your app is live" sub={`https://habits.${DOMAIN}`} top={430} good />
      )}
      <Sfx at={clickPublish + 50} name="chime" volume={0.4} />
      <DCursor points={[[0, 1300, 800], [24, 1525, 236], [80, 1525, 236], [92, 1676, 236]]} clicks={[clickExport, clickPublish]} />
    </AbsoluteFill>
  );
}

function Toast({ at, icon, title, sub, top, good }: { at: number; icon: string; title: string; sub: string; top: number; good?: boolean }) {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", right: 170, top, width: 560, padding: "20px 24px", borderRadius: 14, background: D.panel2, border: `1px solid ${good ? "rgba(134,239,172,0.4)" : D.line}`, boxShadow: "0 30px 60px -20px rgba(0,0,0,0.9)", display: "flex", gap: 16, alignItems: "center", ...rise(frame, at, 16) }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: good ? "rgba(134,239,172,0.12)" : D.panel, color: good ? D.good : D.ink, fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 20, color: D.ink }}>{title}</div>
        <div style={{ fontFamily: mono, fontSize: 16, color: good ? D.good : D.muted, marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

export function StardoomAppDemo() {
  return (
    <AbsoluteFill style={{ background: D.bg }}>
      <Html5Audio src={staticFile("sfx/stardoom-app.wav")} volume={0.5} />
      <Sequence durationInFrames={80}>
        <Title />
      </Sequence>
      <Sequence from={72} durationInFrames={222}>
        <Provider />
      </Sequence>
      <Sequence from={288} durationInFrames={262}>
        <LocalBuild />
      </Sequence>
      <Sequence from={544} durationInFrames={202}>
        <Ship />
      </Sequence>
      <Sequence from={740} durationInFrames={160}>
        <EndCard line="Download for Windows and macOS at stardoom.org" />
      </Sequence>
    </AbsoluteFill>
  );
}
