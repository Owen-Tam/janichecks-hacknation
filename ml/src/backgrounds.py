"""Synthetic home surfaces a picked leaf might be photographed on.

Everything here is procedurally generated (no third-party images, no licence terms).
Real photos dropped into ml/backgrounds/ are mixed in when present.
"""

from pathlib import Path

import cv2
import numpy as np

from .config import ML

PHOTO_DIR = ML / "backgrounds"
KINDS = ["wood", "fabric", "concrete", "earth_floor", "paper", "hand"]


def _noise(h, w, rng, octaves=(4, 16, 64), weights=(0.6, 0.3, 0.1)):
    """Smooth multi-scale value noise in [0, 1]."""
    out = np.zeros((h, w), np.float32)
    for cells, wt in zip(octaves, weights):
        grid = rng.random((max(2, h * cells // max(h, w)), max(2, w * cells // max(h, w)))).astype(np.float32)
        out += wt * cv2.resize(grid, (w, h), interpolation=cv2.INTER_CUBIC)
    out -= out.min()
    return out / max(out.max(), 1e-6)


def _tint(gray, color_lo, color_hi):
    lo, hi = np.array(color_lo, np.float32), np.array(color_hi, np.float32)
    return np.clip(lo + gray[..., None] * (hi - lo), 0, 255).astype(np.uint8)


def wood(h, w, rng):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    warp = _noise(h, w, rng, octaves=(3, 8), weights=(0.7, 0.3)) * rng.uniform(20, 60)
    freq = rng.uniform(0.04, 0.12)
    grain = 0.5 + 0.5 * np.sin((yy + warp) * freq + _noise(h, w, rng, octaves=(32, 128), weights=(0.5, 0.5)) * 2)
    gray = 0.7 * grain + 0.3 * _noise(h, w, rng)
    base = rng.uniform(0.6, 1.2)
    img = _tint(gray, np.array([70, 40, 20]) * base, np.array([170, 115, 70]) * base)
    angle = rng.uniform(0, 180)
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, m, (w, h), borderMode=cv2.BORDER_REFLECT)


def fabric(h, w, rng):
    """Bold printed cloth, kanga / kitenge style: stripes, checks or dots."""
    palette = rng.integers(20, 235, size=(rng.integers(2, 5), 3)).astype(np.uint8)
    yy, xx = np.mgrid[0:h, 0:w]
    period = int(rng.integers(12, 48))
    style = rng.choice(["stripes", "checks", "dots"])
    if style == "stripes":
        idx = (yy // period) % len(palette)
    elif style == "checks":
        idx = ((yy // period) + (xx // period)) % len(palette)
    else:
        cy, cx = (yy % period) - period / 2, (xx % period) - period / 2
        idx = np.where(cy**2 + cx**2 < (period / 3) ** 2, 1, 0) % len(palette)
    img = palette[idx]
    weave = (0.85 + 0.15 * _noise(h, w, rng, octaves=(64, 200), weights=(0.5, 0.5)))[..., None]
    img = np.clip(img * weave, 0, 255).astype(np.uint8)
    m = cv2.getRotationMatrix2D((w / 2, h / 2), rng.uniform(-30, 30), 1.0)
    return cv2.warpAffine(img, m, (w, h), borderMode=cv2.BORDER_REFLECT)


def concrete(h, w, rng):
    gray = 0.7 * _noise(h, w, rng, octaves=(8, 32, 128), weights=(0.4, 0.3, 0.3)) + 0.3 * rng.random((h, w))
    level = rng.uniform(90, 170)
    return _tint(gray, [level - 40] * 3, [level + 40] * 3)


def earth_floor(h, w, rng):
    """Packed earth / murram: red-brown with grit."""
    gray = 0.6 * _noise(h, w, rng, octaves=(6, 24, 96), weights=(0.5, 0.3, 0.2)) + 0.4 * rng.random((h, w))
    red = rng.uniform(0.8, 1.2)
    img = _tint(gray, np.array([80, 45, 25]) * red, np.array([175, 110, 70]) * red)
    grit = rng.random((h, w)) > 0.995
    img[grit] = rng.integers(150, 230)
    return img


def paper(h, w, rng):
    level = rng.uniform(200, 250)
    gray = 0.9 + 0.1 * _noise(h, w, rng, octaves=(4, 32), weights=(0.7, 0.3))
    img = _tint(gray, [level * 0.92, level * 0.9, level * 0.82], [level, level, level * 0.95])
    if rng.random() < 0.6:
        spacing = int(rng.integers(18, 30))
        img[spacing::spacing] = (img[spacing::spacing] * np.array([0.75, 0.82, 0.95])).astype(np.uint8)
    return img


def hand(h, w, rng):
    """A palm filling much of the frame over another surface."""
    under = generate(rng.choice(["wood", "fabric", "concrete", "earth_floor"]), h, w, rng)
    tone = np.array(SKIN_TONES[rng.integers(len(SKIN_TONES))], np.float32)
    shade = 0.85 + 0.25 * _noise(h, w, rng, octaves=(3, 12, 96), weights=(0.6, 0.3, 0.1))
    skin = np.clip(tone * shade[..., None], 0, 255).astype(np.uint8)

    # Drawn upright (fingers at the top), then rotated as a whole.
    shape = np.zeros((h, w), np.uint8)
    cx, cy, rx, ry = w // 2, int(h * 0.62), int(w * 0.3), int(h * 0.3)
    cv2.ellipse(shape, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    finger_w = rx // 2
    for k in range(4):
        x = cx - rx + finger_w // 2 + k * (2 * rx - finger_w) // 3
        top = int(cy - ry - h * rng.uniform(0.15, 0.3))
        cv2.line(shape, (x, cy - ry // 2), (x, top), 255, finger_w, cv2.LINE_AA)
    cv2.line(shape, (cx - rx, cy), (int(cx - rx - w * 0.15), int(cy - ry * 0.9)), 255, finger_w, cv2.LINE_AA)
    for _ in range(3):
        cv2.ellipse(skin, (cx + int(rng.integers(-rx // 3, rx // 3)), cy + int(rng.integers(-ry // 2, ry // 3))),
                    (int(rx * rng.uniform(0.5, 0.9)), int(ry * rng.uniform(0.2, 0.5))), rng.uniform(-20, 20),
                    200, 340, (tone * 0.78).tolist(), 2, cv2.LINE_AA)

    m = cv2.getRotationMatrix2D((w / 2, h / 2), rng.uniform(0, 360), rng.uniform(1.0, 1.4))
    shape = cv2.warpAffine(shape, m, (w, h))
    skin = cv2.warpAffine(skin, m, (w, h), borderMode=cv2.BORDER_REFLECT)
    alpha = cv2.GaussianBlur(shape, (0, 0), 3).astype(np.float32)[..., None] / 255
    return (skin * alpha + under * (1 - alpha)).astype(np.uint8)


SKIN_TONES = [[72, 50, 40], [105, 74, 58], [140, 100, 78], [180, 138, 112], [205, 165, 140]]


_GENERATORS = {"wood": wood, "fabric": fabric, "concrete": concrete,
               "earth_floor": earth_floor, "paper": paper, "hand": hand}


def generate(kind, h, w, rng):
    return _GENERATORS[kind](h, w, rng)


def _photos():
    if not PHOTO_DIR.exists():
        return []
    return sorted(p for p in PHOTO_DIR.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})


def random_background(h, w, rng, photo_prob=0.5):
    """A background of the given size: a real photo crop if any exist, else a synthetic surface."""
    photos = _photos()
    if photos and rng.random() < photo_prob:
        img = cv2.cvtColor(cv2.imread(str(photos[rng.integers(len(photos))])), cv2.COLOR_BGR2RGB)
        s = max(h / img.shape[0], w / img.shape[1]) * rng.uniform(1.0, 1.5)
        img = cv2.resize(img, (int(np.ceil(img.shape[1] * s)), int(np.ceil(img.shape[0] * s))))
        y, x = rng.integers(0, img.shape[0] - h + 1), rng.integers(0, img.shape[1] - w + 1)
        return img[y:y + h, x:x + w].copy(), "photo"
    kind = rng.choice(KINDS)
    return generate(kind, h, w, rng), str(kind)
