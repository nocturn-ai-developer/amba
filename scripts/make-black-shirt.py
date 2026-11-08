# Regenerate: python -I scripts/make-black-shirt.py public/landing/aestra-suit.webp public/landing/aestra-suit-black.webp <preview_dir>
"""Recolours Aestra's white shirt to black in the suit render, keeping folds/shading. Skin (warm) is left alone.

Usage: python -I shirt_black.py <in.webp> <out.webp> <preview_dir>
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, dst, prev = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert("RGB")
W, H = im.size
a = np.asarray(im).astype(np.float32)

# Torso region between the jacket lapels (picked on a 0.75x crop at offset 1100,1050; mapped to full res).
def full(pts):
    return [(x / 0.75 + 1100, y / 0.75 + 1050) for x, y in pts]

from scipy import ndimage

poly = full([(268, 62), (512, 62), (550, 96), (684, 330), (765, 624), (124, 624), (192, 330)])
region_img = Image.new("L", (W, H), 0)
ImageDraw.Draw(region_img).polygon(poly, fill=255)

r, g, b = a[..., 0], a[..., 1], a[..., 2]
v = a.max(axis=2) / 255
warm = r - b

# Skin = the one big warm area (face, neck and the V of the chest), with its holes filled (freckles, cool
# highlights). Found over the whole upper body, not just the shirt area, so the polygon edge never cuts it.
# Warm patches elsewhere (shirt under the collar catching skin light) are small separate blobs: they are shirt.
y0 = int(min(p[1] for p in poly)) - 400
skin_raw = np.zeros((H, W), bool)
skin_raw[y0:] = ((warm > 9) & (v > 0.3))[y0:]
lab, n = ndimage.label(skin_raw)
sizes = ndimage.sum(skin_raw, lab, index=np.arange(1, n + 1))
main = lab == (1 + int(np.argmax(sizes)))
skin = ndimage.binary_fill_holes(ndimage.binary_closing(main, iterations=4))
# Smooth the skin outline so the shirt edge is clean, then keep the shirt colour 1px off the skin.
skin_soft = np.asarray(Image.fromarray((skin * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))).astype(np.float32) / 255
not_skin = np.clip((0.85 - skin_soft) / 0.3, 0, 1)

# Shirt = inside the lapels, not skin, not the dark jacket. Soft edges against skin and jacket.
bright = np.clip((v - 0.26) / 0.14, 0, 1)
soft_inside = np.asarray(region_img.filter(ImageFilter.GaussianBlur(4))).astype(np.float32) / 255
mask = soft_inside * not_skin * bright

# Black fabric: keep the shirt's own light/shadow pattern, compressed into a dark range with a faint cool tint.
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
lo, hi = np.percentile(lum[mask > 0.6], [2, 99.5])
t = np.clip((lum - lo) / max(1, hi - lo), 0, 1)
dark = 10 + t ** 1.15 * 58  # 10..68
black = np.stack([dark * 0.97, dark * 0.98, dark * 1.04], axis=-1)
out = a * (1 - mask[..., None]) + black * mask[..., None]
res = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
res.save(dst, "WEBP", quality=92, method=6)

crop = (1100, 1050, 2300, H)
for name, img in (("before", im), ("after", res)):
    c = img.crop(crop)
    c.thumbnail((900, 900))
    c.save(f"{prev}/shirt-{name}.png")
m = Image.fromarray((mask * 255).astype(np.uint8)).crop(crop)
m.thumbnail((900, 900))
m.save(f"{prev}/shirt-mask.png")
print("ok", dst, res.size)
