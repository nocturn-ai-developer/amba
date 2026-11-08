// Stardoom AI launch kit for X.
//   node render-stardoom.mjs stills            profile, banner and the two post images → ../x-launch/
//   node render-stardoom.mjs frames            preview frames of the three videos → out/frames/
//   node render-stardoom.mjs videos [id ...]   the 30-second videos (loudness-normalised) → ../x-launch/
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const OUT = path.resolve("../x-launch");
mkdirSync(OUT, { recursive: true });
const [mode = "stills", ...rest] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });

if (mode === "stills") {
  const stills = [
    ["XProfile", "01-profile-picture.png", 1],
    ["XBanner", "02-header-banner.png", 2],
    ["PostIntroducing", "post-4-image-introducing.png", 1],
    ["PostToken", "post-5-image-token.png", 1],
  ];
  for (const [id, file, scale] of stills) {
    const composition = await selectComposition({ serveUrl, id });
    await renderStill({ serveUrl, composition, frame: 0, output: path.join(OUT, file), scale, imageFormat: "png" });
    console.log("still", file);
  }
}

if (mode === "frames") {
  const frames = { StardoomIntro: [60, 160, 240, 300, 400, 480, 560, 680, 780, 870], StardoomWebDemo: [50, 200, 290, 420, 540, 690, 800, 880], StardoomAppDemo: [50, 160, 270, 420, 520, 640, 720, 860] };
  for (const [id, list] of Object.entries(frames)) {
    if (rest.length && !rest.includes(id)) continue;
    const composition = await selectComposition({ serveUrl, id });
    for (const frame of list) {
      const output = path.resolve(`out/frames/${id}-${String(frame).padStart(3, "0")}.jpg`);
      await renderStill({ serveUrl, composition, frame, output, scale: 0.5, imageFormat: "jpeg" });
    }
    console.log("frames", id);
  }
}

/** X-friendly audio: loudness-normalised AAC at 48 kHz; the video stream is copied as is. Paths are quoted (spaces). */
function finish(raw, out) {
  const q = (p) => `"${p}"`;
  execFileSync(`npx remotion ffmpeg -y -v error -i ${q(raw)} -c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k -movflags +faststart ${q(out)}`, { stdio: "inherit", shell: true });
}

if (mode === "videos") {
  const videos = [
    ["StardoomIntro", "post-1-video-introducing.mp4"],
    ["StardoomWebDemo", "post-2-video-demo-web.mp4"],
    ["StardoomAppDemo", "post-3-video-demo-desktop.mp4"],
  ];
  for (const [id, file] of videos) {
    if (rest.filter((r) => !r.startsWith("--")).length && !rest.includes(id)) continue;
    const composition = await selectComposition({ serveUrl, id });
    const raw = path.resolve(`out/${id}-raw.mp4`);
    if (rest.includes("--finish-only")) {
      finish(raw, path.join(OUT, file));
      continue;
    }
    await renderMedia({ serveUrl, composition, codec: "h264", crf: 18, outputLocation: raw, onProgress: ({ progress }) => process.stdout.write(`\r${id} ${(progress * 100).toFixed(0)}%   `) });
    console.log();
    // X-friendly audio: loudness-normalised AAC at 48 kHz; video stream copied as is.
    finish(raw, path.join(OUT, file));
    rmSync(raw, { force: true });
    console.log("video", file);
  }
}
