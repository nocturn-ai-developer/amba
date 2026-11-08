"""Prepares the two landing-page character renders (outer look + inner look revealed by the cursor).

    python -I scripts/prepare-hero.py <outer.png|jpg|webp> <inner.png|jpg|webp> [--out public/landing] [--check-dir DIR]

What it does
  1. Crops both images to 16:9 around the centre (the landing photo is 16:9).
  2. Resizes the inner image to the outer one's size if they differ.
  3. Aligns the inner image onto the outer one (phase correlation): AI generators often shift the figure a little
     between two variations, which makes the cursor reveal look wrong. Small shifts are fixed automatically;
     a large shift means the poses differ and you should generate again.
  4. Writes public/landing/hero-outer.webp and hero-inner.webp (max 3344 px wide). The landing page picks them up
     automatically; delete them to go back to the previous character.
  5. Optionally writes check images: a 50/50 blend of both (should look like one figure, not a double image).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ASPECT = 16 / 9
MAX_W = 3344


def crop_16_9(im: Image.Image) -> Image.Image:
    w, h = im.size
    if abs(w / h - ASPECT) < 0.01:
        return im
    if w / h > ASPECT:  # too wide: trim the sides
        nw = round(h * ASPECT)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = round(w / ASPECT)  # too tall: trim top and bottom, keep a little more of the top (heads)
    y = max(0, (h - nh) // 3)
    return im.crop((0, y, w, y + nh))


def gray_small(im: Image.Image, width: int = 1024) -> np.ndarray:
    s = im.convert("L")
    h = round(s.height * width / s.width)
    return np.asarray(s.resize((width, h), Image.LANCZOS), dtype=np.float32)


def phase_shift(a: np.ndarray, b: np.ndarray) -> tuple[float, float, float]:
    """Translation (dx, dy) that moves b onto a, plus a confidence score (peak sharpness)."""
    win = np.outer(np.hanning(a.shape[0]), np.hanning(a.shape[1]))
    fa = np.fft.fft2((a - a.mean()) * win)
    fb = np.fft.fft2((b - b.mean()) * win)
    r = fa * np.conj(fb)
    r /= np.abs(r) + 1e-9
    corr = np.fft.ifft2(r).real
    y, x = np.unravel_index(np.argmax(corr), corr.shape)
    if y > a.shape[0] // 2:
        y -= a.shape[0]
    if x > a.shape[1] // 2:
        x -= a.shape[1]
    return float(x), float(y), float(corr.max() / (np.abs(corr).mean() + 1e-9))


def shift(im: Image.Image, dx: int, dy: int) -> Image.Image:
    """Moves the image by (dx, dy) pixels; uncovered edges are filled with the image's own edge colour."""
    if dx == 0 and dy == 0:
        return im
    edge = tuple(int(c) for c in np.asarray(im)[[0, -1], :, :].reshape(-1, 3).mean(axis=0))
    out = Image.new("RGB", im.size, edge)
    out.paste(im, (dx, dy))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("outer")
    ap.add_argument("inner")
    ap.add_argument("--out", default=os.path.join("public", "landing"))
    ap.add_argument("--check-dir", default=None)
    ap.add_argument("--max-shift", type=float, default=0.03, help="largest shift fixed automatically, as a fraction of the width")
    args = ap.parse_args()

    outer = crop_16_9(Image.open(args.outer).convert("RGB"))
    inner = crop_16_9(Image.open(args.inner).convert("RGB"))
    if outer.width > MAX_W:
        outer = outer.resize((MAX_W, round(MAX_W / outer.width * outer.height)), Image.LANCZOS)
    if inner.size != outer.size:
        print(f"- Inner image resized from {inner.size[0]}x{inner.size[1]} to {outer.size[0]}x{outer.size[1]}")
        inner = inner.resize(outer.size, Image.LANCZOS)
    if outer.width < 1600:
        print(f"WARNING: Only {outer.width}px wide: it will look soft on large screens. 1920px or more is better.")

    a, b = gray_small(outer), gray_small(inner)
    dx_s, dy_s, conf = phase_shift(a, b)
    scale = outer.width / a.shape[1]
    dx, dy = round(dx_s * scale), round(dy_s * scale)
    frac = max(abs(dx) / outer.width, abs(dy) / outer.height)
    if frac <= args.max_shift:
        # Refine to the exact pixel on a full-resolution window around the centre (where the figure is).
        cw, ch = min(1024, outer.width), min(1024, outer.height)
        x0, y0 = (outer.width - cw) // 2, (outer.height - ch) // 2
        fa = np.asarray(outer.convert("L").crop((x0, y0, x0 + cw, y0 + ch)), dtype=np.float32)
        fb = np.asarray(shift(inner, dx, dy).convert("L").crop((x0, y0, x0 + cw, y0 + ch)), dtype=np.float32)
        ddx, ddy, _ = phase_shift(fa, fb)
        if abs(ddx) <= 8 and abs(ddy) <= 8:
            dx, dy = dx + round(ddx), dy + round(ddy)
        frac = max(abs(dx) / outer.width, abs(dy) / outer.height)
    print(f"- Offset between the two images: {dx:+d}px, {dy:+d}px ({frac * 100:.1f}% of the frame), match strength {conf:.0f}")
    if frac > args.max_shift:
        print("ERROR: The figures are too far apart: the two images don't share the same pose/framing.")
        print("  Generate image 2 again from image 1 (same seed, or 'Vary (Region)' / inpaint on the figure only).")
        return 2
    inner = shift(inner, dx, dy)
    if dx or dy:
        print("- Inner image aligned onto the outer one.")

    os.makedirs(args.out, exist_ok=True)
    o_path = os.path.join(args.out, "hero-outer.webp")
    i_path = os.path.join(args.out, "hero-inner.webp")
    outer.save(o_path, "WEBP", quality=90, method=6)
    inner.save(i_path, "WEBP", quality=90, method=6)
    print(f"OK: Wrote {o_path} and {i_path} ({outer.width}x{outer.height})")

    if args.check_dir:
        os.makedirs(args.check_dir, exist_ok=True)
        blend = Image.blend(outer, inner, 0.5)
        blend.thumbnail((1400, 1400))
        p = os.path.join(args.check_dir, "hero-blend-check.png")
        blend.save(p)
        print(f"- Check image: {p} (should look like one figure, not a double image)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
