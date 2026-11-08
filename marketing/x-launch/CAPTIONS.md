# Stardoom AI launch kit for X

Account: **@stardoom_ai** · Website: **stardoom.org** · Ticker: **$STARDOOM** on Robinhood Chain

## Profile

| Field | Value |
|---|---|
| Profile picture | `01-profile-picture.png` (1000×1000, X crops it to a circle) |
| Header | `02-header-banner.png` (3000×1000, shown at 1500×500) |
| Name | STARDOOM AI |
| Bio | Build anything with AI. Describe it → AI builds it → live on its own domain. Web, Windows & macOS. $STARDOOM on Robinhood Chain. |
| Website | stardoom.org |

## Posts

Suggested order: post 1 first and pin it, then one post a day.

### Post 1 · Video · Introducing (`post-1-video-introducing.mp4`, 30 s)

```
Meet STARDOOM AI.

Describe your idea in one sentence. AI writes the code. Your app goes live on its own domain.

No code. No face. Just the idea.

Web · Windows · macOS
$STARDOOM on Robinhood Chain

stardoom.org
```

### Post 2 · Video · Web demo (`post-2-video-demo-web.mp4`, 30 s)

```
From one sentence to a live website.

1. Describe it
2. AI builds it
3. Change anything, just ask
4. Deploy to your-app.stardoom.org

Bring your own Anthropic key. Stardoom charges nothing for AI.

Try it → stardoom.org
$STARDOOM
```

### Post 3 · Video · Desktop app demo (`post-3-video-demo-desktop.mp4`, 30 s)

```
STARDOOM AI, on your desktop.

• Your own Anthropic key, or a local AI (Ollama, LM Studio)
• Builds and previews on your machine, no Docker
• Export the code, or publish to stardoom.org in one click

Windows & macOS → stardoom.org
$STARDOOM
```

### Post 4 · Image · Introducing (`post-4-image-introducing.png`)

```
The face of the builder doesn't matter. The idea does.

STARDOOM AI is live.
Describe it. AI builds it. Live on its own domain.

$STARDOOM · Robinhood Chain
stardoom.org
```

Alt text: `A hooded figure in a black hoodie. The left half of the face is a polished chrome mask, the right half is a wireframe face made of glowing hexadecimal code. Text: Introducing STARDOOM AI. Describe it. AI builds it. Live on its own domain. $STARDOOM, Robinhood Chain, stardoom.org.`

### Post 5 · Image · Token (`post-5-image-token.png`)

```
$STARDOOM on Robinhood Chain.

Every app you build with STARDOOM AI goes live on its own domain, and can launch its own token right from the app.

01 Describe it
02 AI builds it
03 Go live
04 Launch its token

stardoom.org
```

Alt text: `$STARDOOM on Robinhood Chain. Four steps: describe it, AI builds it, go live on your-app.stardoom.org, launch its token. A hooded figure whose face is made of glowing code stands on the right.`

## Before posting

- **Contract address**: none is in these posts. Add the $STARDOOM contract address (and a chart link) once it is final; never post a placeholder.
- **Desktop downloads**: posts 3 and the intro say Windows & macOS. The Windows installer exists; the macOS one is built by CI and has not been produced yet, and stardoom.org has no download page yet. Publish the downloads (or change the wording to "coming soon") before posting 3.
- **Music**: all music and sound effects are synthesised by `remotion/make-stardoom-music.mjs` and `make-audio.mjs` (no samples, no licences needed).

## Regenerate

```bash
cd marketing/remotion
node make-stardoom-music.mjs          # music beds
node render-stardoom.mjs stills       # profile, banner, post images
node render-stardoom.mjs videos       # the three videos
```
