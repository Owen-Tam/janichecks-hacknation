"""Augmentations modelled on how Noor's leaf is actually photographed.

The leaf is picked on the slope during the week and photographed at home on the
weekend, on the daughter's budget Android phone. Every group below maps to one part
of that scenario. All outputs are synthetic.

Label safety: nothing here may fake or erase a symptom. Hue shifts stay within a few
degrees (no yellowing or browning), no blotches are drawn, and blur / downscale /
JPEG strength is capped so small lesions stay visible at the model's input size.
"""

import albumentations as A
import cv2
import numpy as np

from .backgrounds import generate, random_background

SIZE = 256
CANVAS = 512


def _seeded(transform, rng):
    transform.set_random_seed(int(rng.integers(2**31 - 1)))
    return transform


# ---------------------------------------------------------------- geometry + background

def _leaf_center_and_extent(mask, angle):
    """Centre and width/height of the leaf after rotating by `angle` (OpenCV convention)."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        h, w = mask.shape
        return (w / 2, h / 2), (w, h)
    pts = np.concatenate(contours)[:, 0].astype(np.float32)
    t = np.deg2rad(angle)
    rot = np.array([[np.cos(t), np.sin(t)], [-np.sin(t), np.cos(t)]], np.float32)
    r = pts @ rot.T
    lo, hi = r.min(axis=0), r.max(axis=0)
    cx, cy = ((lo + hi) / 2) @ rot  # back to crop coordinates
    return (float(cx), float(cy)), (float(hi[0] - lo[0]), float(hi[1] - lo[1]))


def _bracol_paper(crop, mask, canvas, rng):
    """A clean stand-in for BRACOL's own background: its median colour plus soft shading."""
    bg_pixels = crop[mask == 0]
    color = np.median(bg_pixels, axis=0) if len(bg_pixels) else np.array([235, 235, 235])
    yy, xx = np.mgrid[0:canvas, 0:canvas].astype(np.float32) / canvas
    t = rng.uniform(0, 2 * np.pi)
    shade = 1 - rng.uniform(0, 0.15) * (np.cos(t) * (xx - 0.5) + np.sin(t) * (yy - 0.5) + 0.5)
    return np.clip(color[None, None] * shade[..., None], 0, 255)


def place_leaf(crop, mask, rng, background="white", angle=None, scale_range=(0.8, 1.0),
               visible_min=0.92, shadow=True, center=False, canvas=CANVAS):
    """Rotate, scale and position the leaf on a square canvas, compositing it with its mask.

    background: "white" (a clean version of BRACOL's own paper), "home" (a random home
    surface) or a specific surface name from backgrounds.KINDS. scale is the leaf's
    rotated extent relative to the canvas. Lesion positions are unknown, so only a small
    sliver of the leaf (1 - visible_min per axis) may leave the frame; more could crop the
    only symptom out and leave a wrong label. Returns (image, placed_mask, bg_kind).
    """
    angle = rng.uniform(0, 360) if angle is None else angle
    (cx, cy), (lw, lh) = _leaf_center_and_extent(mask, angle)
    s = canvas * rng.uniform(*scale_range) / max(lw, lh)
    lw, lh = lw * s, lh * s

    def centre_range(extent):
        slack = (1 - visible_min) * extent
        lo, hi = extent / 2 - slack, canvas - extent / 2 + slack
        return (lo, hi) if lo < hi else (canvas / 2, canvas / 2)

    if center:
        tx = ty = canvas / 2
    else:
        tx, ty = rng.uniform(*centre_range(lw)), rng.uniform(*centre_range(lh))
    m = cv2.getRotationMatrix2D((cx, cy), angle, s)
    m[:, 2] += (tx - cx, ty - cy)

    leaf = cv2.warpAffine(crop, m, (canvas, canvas), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_REPLICATE)
    placed = cv2.warpAffine(mask, m, (canvas, canvas), flags=cv2.INTER_NEAREST, borderValue=0)

    if background == "white":
        bg, kind = _bracol_paper(crop, mask, canvas, rng), "white"
    else:
        if background == "home":
            bg, kind = random_background(canvas, canvas, rng)
        else:
            bg, kind = generate(background, canvas, canvas, rng), background
        bg = bg.astype(np.float32)
        if rng.random() < 0.3:
            bg = cv2.GaussianBlur(bg, (0, 0), rng.uniform(1, 3))
    if shadow:
        offset = rng.uniform(3, 14, size=2) * rng.choice([-1, 1], size=2)
        sm = cv2.warpAffine(placed, np.float32([[1, 0, offset[0]], [0, 1, offset[1]]]), (canvas, canvas))
        sm = cv2.GaussianBlur(sm.astype(np.float32) / 255, (0, 0), rng.uniform(5, 12))
        bg *= 1 - rng.uniform(0.25, 0.5) * sm[..., None]
    # Erode before feathering so BRACOL's white fringe around the leaf edge doesn't come along.
    alpha = cv2.erode(placed, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    alpha = cv2.GaussianBlur(alpha.astype(np.float32) / 255, (0, 0), 1.2)[..., None]
    out = leaf.astype(np.float32) * alpha + bg * (1 - alpha)
    return np.clip(out, 0, 255).astype(np.uint8), placed, kind


def eval_view(crop, mask, size=SIZE):
    """Deterministic validation / test view: the leaf as photographed, centred, unrotated."""
    img, _, _ = place_leaf(crop, mask, np.random.default_rng(0), background="white", angle=0,
                           scale_range=(0.95, 0.95), shadow=False, center=True)
    return to_model_size(img, size)


# ---------------------------------------------------------------- picked leaf (curl, dulling)

CURL_VARIANTS = {
    "elastic": A.ElasticTransform(alpha=60, sigma=12, border_mode=cv2.BORDER_REFLECT_101, p=1),
    "grid": A.GridDistortion(num_steps=5, distort_limit=(-0.15, 0.15), border_mode=cv2.BORDER_REFLECT_101, p=1),
    "perspective": A.Perspective(scale=(0.03, 0.08), border_mode=cv2.BORDER_REFLECT_101, p=1),
}
_CURL = A.OneOf(list(CURL_VARIANTS.values()), p=1)
_DULL = A.HueSaturationValue(hue_shift_limit=(-3, 3), sat_shift_limit=(-25, 0), val_shift_limit=(-10, 0), p=1)


def picked_leaf(img, rng):
    img = _seeded(A.Compose([_CURL]), rng)(image=img)["image"]
    if rng.random() < 0.7:
        img = _seeded(A.Compose([_DULL]), rng)(image=img)["image"]
    return img


# ---------------------------------------------------------------- home lighting

def _side_light(img, rng):
    """Daylight from a doorway or window: one side bright, the other in shade."""
    h, w = img.shape[:2]
    t = rng.uniform(0, 2 * np.pi)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ramp = (np.cos(t) * (xx / w - 0.5) + np.sin(t) * (yy / h - 0.5)) + 0.5
    gain = rng.uniform(0.6, 0.8) + ramp * rng.uniform(0.3, 0.6)
    return np.clip(img.astype(np.float32) * gain[..., None], 0, 255).astype(np.uint8)


def _white_balance(img, rng):
    """Warm bulb, solar lamp or kerosene lamp. Applied to the whole frame, never locally."""
    gains = np.array([rng.uniform(1.04, 1.16), rng.uniform(0.97, 1.03), rng.uniform(0.78, 0.92)], np.float32)
    return np.clip(img.astype(np.float32) * gains, 0, 255).astype(np.uint8)


_SHADOW = A.RandomShadow(shadow_roi=(0, 0, 1, 1), num_shadows_limit=(1, 2), shadow_dimension=4,
                         shadow_intensity_range=(0.15, 0.4), p=1)
_YARD = A.Compose([A.RandomBrightnessContrast(brightness_limit=(0.03, 0.18), contrast_limit=(0.0, 0.2), p=1),
                   A.RandomGamma(gamma_limit=(80, 95), p=1)])
# Gamma darkens mid-tones but keeps highlights, so lesions stay distinguishable from leaf tissue.
_DIM = A.Compose([A.RandomGamma(gamma_limit=(120, 155), p=1),
                  A.RandomBrightnessContrast(brightness_limit=(-0.12, -0.03), contrast_limit=(-0.15, 0.0), p=1),
                  A.ISONoise(color_shift=(0.01, 0.03), intensity=(0.1, 0.35), p=1)])
_LAMP_DIM = A.RandomBrightnessContrast(brightness_limit=(-0.2, 0.0), contrast_limit=(-0.1, 0.1), p=1)

LIGHTING = ["window", "yard", "dim", "lamp"]


def home_lighting(img, rng, kind=None):
    kind = kind or rng.choice(LIGHTING)
    if kind == "window":
        img = _side_light(img, rng)
        if rng.random() < 0.35:
            img = _seeded(A.Compose([_SHADOW]), rng)(image=img)["image"]
    elif kind == "yard":
        img = _seeded(_YARD, rng)(image=img)["image"]
    elif kind == "dim":
        img = _seeded(_DIM, rng)(image=img)["image"]
    else:
        img = _seeded(A.Compose([_LAMP_DIM]), rng)(image=_white_balance(img, rng))["image"]
    return img


# ---------------------------------------------------------------- budget camera + handheld

# Strengths are relative to the 256 px model input and capped so small lesions survive.
CAMERA_VARIANTS = {
    "gauss_noise": A.GaussNoise(std_range=(0.02, 0.06), p=1),
    "iso_noise": A.ISONoise(color_shift=(0.01, 0.04), intensity=(0.1, 0.4), p=1),
    "jpeg": A.ImageCompression(quality_range=(30, 80), p=1),
    "downscale": A.Downscale(scale_range=(0.65, 0.9),
                             interpolation_pair={"downscale": cv2.INTER_AREA, "upscale": cv2.INTER_LINEAR}, p=1),
}
_CAMERA = A.OneOf(list(CAMERA_VARIANTS.values()), p=1)
_JPEG = A.ImageCompression(quality_range=(50, 90), p=1)
BLUR_VARIANTS = {
    "motion": A.MotionBlur(blur_limit=(3, 3), p=1),
    "defocus": A.Defocus(radius=(1, 1), alias_blur=(0.1, 0.2), p=1),
    "gaussian": A.GaussianBlur(blur_limit=(3, 3), sigma_limit=(0.3, 0.7), p=1),
}
_BLUR = A.OneOf(list(BLUR_VARIANTS.values()), p=1)


def apply(transform, img, rng):
    """Run a single albumentations transform reproducibly from a numpy Generator."""
    return _seeded(A.Compose([transform]), rng)(image=img)["image"]


def budget_camera(img, rng):
    img = _seeded(A.Compose([_CAMERA]), rng)(image=img)["image"]
    if rng.random() < 0.5:
        img = _seeded(A.Compose([_JPEG]), rng)(image=img)["image"]
    return img


def handheld_blur(img, rng):
    return _seeded(A.Compose([_BLUR]), rng)(image=img)["image"]


def to_model_size(img, size=SIZE):
    return cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)


# ---------------------------------------------------------------- full pipelines

P_HOME_BACKGROUND = 0.6
P_LIGHTING = 0.8
P_PICKED = 0.4
P_CAMERA = 0.7
P_BLUR = 0.3


def light(crop, mask, rng, size=SIZE):
    """Baseline: flips, any rotation, small scale/position jitter on a BRACOL-style white background."""
    if rng.random() < 0.5:
        crop, mask = crop[:, ::-1].copy(), mask[:, ::-1].copy()
    img, _, _ = place_leaf(crop, mask, rng, background="white", scale_range=(0.9, 1.05), visible_min=0.9, shadow=False)
    return to_model_size(img, size)


def scenario(crop, mask, rng, size=SIZE, return_steps=False):
    """Weekend photo at home of a leaf picked during the week, on a budget phone."""
    steps = []
    if rng.random() < 0.5:
        crop, mask = crop[:, ::-1].copy(), mask[:, ::-1].copy()
    bg = "home" if rng.random() < P_HOME_BACKGROUND else "white"
    img, _, kind = place_leaf(crop, mask, rng, background=bg)
    steps.append(f"bg:{kind}")
    if rng.random() < P_PICKED:
        img = picked_leaf(img, rng)
        steps.append("picked")
    if rng.random() < P_LIGHTING:
        k = rng.choice(LIGHTING)
        img = home_lighting(img, rng, kind=k)
        steps.append(f"light:{k}")
    img = to_model_size(img, size)
    if rng.random() < P_CAMERA:
        img = budget_camera(img, rng)
        steps.append("camera")
    if rng.random() < P_BLUR:
        img = handheld_blur(img, rng)
        steps.append("blur")
    return (img, steps) if return_steps else img


PIPELINES = {"light": light, "scenario": scenario}
