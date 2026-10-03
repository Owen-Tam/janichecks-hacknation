"""Separate the leaf from BRACOL's white background, crop to it, and cache the result."""

from concurrent.futures import ProcessPoolExecutor

import cv2
import numpy as np
import pandas as pd

from .config import CACHE_INDEX, CROPS, IMAGES, MASKS

WORK_WIDTH = 512
CROP_LONG_SIDE = 768
MARGIN = 0.05


def read_rgb(path):
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def _fill_holes(mask):
    # Pad first: a leaf spanning the full width splits the background in two, and both
    # halves must be reachable from the flood seed or one of them gets filled as a "hole".
    flood = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    h, w = flood.shape
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    return mask | cv2.bitwise_not(flood[1:-1, 1:-1])


def _otsu(channel, lo, hi):
    t, _ = cv2.threshold(np.clip(channel, 0, 255).astype(np.uint8), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return np.clip(t, lo, hi)


def _background_distance(small):
    """Chroma distance from the background colour, estimated from the image border.

    Lightness is ignored on purpose: backgrounds range from white to dark grey with
    vignettes and shadows, but they stay neutral in colour.
    """
    lab = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2LAB).astype(np.float32), (5, 5), 0)
    b = 8
    border = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3),
                             lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    d = lab - np.median(border, axis=0)
    return 2 * np.sqrt(d[..., 1] ** 2 + d[..., 2] ** 2)


def leaf_mask(rgb):
    """Return a uint8 mask (255 = leaf) at the input resolution.

    Union of three cues, because no single one covers every leaf: saturation (healthy
    tissue), colour distance from the background (pale or grey-green leaves), and
    darkness (dead tips, stems, necrotic lesions). Holes inside the outline are filled.
    """
    h, w = rgb.shape[:2]
    scale = WORK_WIDTH / w
    small = cv2.resize(rgb, (WORK_WIDTH, round(h * scale)), interpolation=cv2.INTER_AREA)
    hsv = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_RGB2HSV), (5, 5), 0)
    sat, val = hsv[..., 1], hsv[..., 2]
    dist = _background_distance(small)

    fg = (sat > _otsu(sat, 20, 90)) | (dist > _otsu(dist, 20, 80)) | (val < 70)
    fg = fg.astype(np.uint8) * 255

    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))

    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if n > 1:
        largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(labels == largest, 255, 0).astype(np.uint8)
    fg = _fill_holes(fg)

    full = cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR)
    return np.where(full > 127, 255, 0).astype(np.uint8)


def leaf_bbox(mask, margin=MARGIN):
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return 0, 0, mask.shape[1], mask.shape[0]
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = int(margin * max(x1 - x0, y1 - y0))
    h, w = mask.shape
    return max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)


def crop_leaf(rgb, mask, long_side=CROP_LONG_SIDE):
    x0, y0, x1, y1 = leaf_bbox(mask)
    crop, mcrop = rgb[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    s = long_side / max(crop.shape[:2])
    size = (round(crop.shape[1] * s), round(crop.shape[0] * s))
    crop = cv2.resize(crop, size, interpolation=cv2.INTER_AREA)
    mcrop = cv2.resize(mcrop, size, interpolation=cv2.INTER_NEAREST)
    return crop, mcrop, (x0, y0, x1, y1)


def process_one(image_id, overwrite=False):
    crop_path, mask_path = CROPS / f"{image_id}.jpg", MASKS / f"{image_id}.png"
    rgb = read_rgb(IMAGES / f"{image_id}.jpg")
    mask = leaf_mask(rgb)
    crop, mcrop, bbox = crop_leaf(rgb, mask)
    if overwrite or not (crop_path.exists() and mask_path.exists()):
        cv2.imwrite(str(crop_path), cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])
        cv2.imwrite(str(mask_path), mcrop)
    x0, y0, x1, y1 = bbox
    edges = [mask[0], mask[-1], mask[:, 0], mask[:, -1]]
    return {
        "id": image_id,
        "x0": x0, "y0": y0, "x1": x1, "y1": y1,
        "leaf_frac": float((mask > 0).mean()),
        "leaf_cut_by_frame": bool(any(e.any() for e in edges)),
    }


def build_cache(ids, workers=8, overwrite=False):
    CROPS.mkdir(parents=True, exist_ok=True)
    MASKS.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        rows = list(pool.map(process_one, ids, [overwrite] * len(ids), chunksize=16))
    index = pd.DataFrame(rows).sort_values("id").reset_index(drop=True)
    index.to_csv(CACHE_INDEX, index=False)
    return index
