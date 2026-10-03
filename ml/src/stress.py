"""Deterministic stress-test conditions: the clean split re-photographed "at home".

Each condition is a fixed recipe; the randomness inside it (angle, background, shadow
position, ...) is seeded per image, so every model sees exactly the same images.

The "seen" conditions reuse the families the scenario augmentation trains on, so they
favour the scenario models by construction. The "unseen" conditions are outside every
model's training augmentation and are the fairer comparison.
"""

import albumentations as A
import cv2
import numpy as np
import pandas as pd
from torch.utils.data import Dataset

from . import augment as aug
from .config import ROOT
from .dataset import to_tensor

_BIG = aug.CANVAS


def _white(crop, mask, rng):
    return aug.place_leaf(crop, mask, rng, background="white", angle=0, scale_range=(0.95, 0.95),
                          shadow=False, center=True)[0]


def _home(crop, mask, rng):
    return aug.place_leaf(crop, mask, rng, background="home", scale_range=(0.85, 0.95))[0]


def _fixed(transform):
    return lambda img, rng: aug.apply(transform, img, rng)


_CAMERA = A.Compose([
    A.Downscale(scale_range=(0.7, 0.7), interpolation_pair={"downscale": cv2.INTER_AREA, "upscale": cv2.INTER_LINEAR}, p=1),
    A.ISONoise(color_shift=(0.02, 0.02), intensity=(0.25, 0.25), p=1),
    A.ImageCompression(quality_range=(50, 50), p=1),
])
_FORWARDED = A.Compose([
    A.Downscale(scale_range=(0.45, 0.45), interpolation_pair={"downscale": cv2.INTER_AREA, "upscale": cv2.INTER_LINEAR}, p=1),
    A.ImageCompression(quality_range=(20, 20), p=1),
])
camera = _fixed(_CAMERA)
motion_blur = _fixed(A.MotionBlur(blur_limit=(3, 3), p=1))
strong_blur = _fixed(A.MotionBlur(blur_limit=(7, 7), p=1))
forwarded = _fixed(_FORWARDED)


def _cool_led(img, rng):
    gains = np.array([0.86, 0.98, 1.15], np.float32)
    return np.clip(img.astype(np.float32) * gains, 0, 255).astype(np.uint8)


def _dim_warm(img, rng):
    return aug.home_lighting(aug.home_lighting(img, rng, kind="lamp"), rng, kind="dim")


def _realistic(crop, mask, rng, size):
    img = _home(crop, mask, rng)
    img = aug.picked_leaf(img, rng)
    img = aug.home_lighting(img, rng)
    img = camera(aug.to_model_size(img, size), rng)
    return motion_blur(img, rng)


# name -> (seen in scenario training?, recipe(crop, mask, rng, size) -> uint8 image at `size`)
CONDITIONS = {
    "clean": (True, lambda c, m, r, s: aug.eval_view(c, m, s)),
    "home background": (True, lambda c, m, r, s: aug.to_model_size(_home(c, m, r), s)),
    "window side light": (True, lambda c, m, r, s: aug.to_model_size(aug.home_lighting(_white(c, m, r), r, kind="window"), s)),
    "dim warm lamp": (True, lambda c, m, r, s: aug.to_model_size(_dim_warm(_white(c, m, r), r), s)),
    "picked leaf curl": (True, lambda c, m, r, s: aug.to_model_size(aug.picked_leaf(_white(c, m, r), r), s)),
    "budget camera": (True, lambda c, m, r, s: camera(aug.eval_view(c, m, s), r)),
    "handheld blur": (True, lambda c, m, r, s: motion_blur(aug.eval_view(c, m, s), r)),
    "realistic weekend photo": (True, _realistic),
    "UNSEEN cool LED light": (False, lambda c, m, r, s: _cool_led(aug.eval_view(c, m, s), r)),
    "UNSEEN forwarded photo": (False, lambda c, m, r, s: forwarded(aug.eval_view(c, m, s), r)),
    "UNSEEN strong blur": (False, lambda c, m, r, s: strong_blur(aug.eval_view(c, m, s), r)),
}


def render(condition, crop, mask, image_id, size, seed=0):
    k = list(CONDITIONS).index(condition)
    rng = np.random.default_rng([seed, int(image_id), k])
    return CONDITIONS[condition][1](crop, mask, rng, size)


class StressDataset(Dataset):
    def __init__(self, split_csv, condition, size):
        self.df = pd.read_csv(split_csv)
        self.condition, self.size = condition, size

    def __len__(self):
        return len(self.df)

    def image(self, idx):
        row = self.df.iloc[idx]
        crop = cv2.cvtColor(cv2.imread(str(ROOT / row["crop"])), cv2.COLOR_BGR2RGB)
        mask = cv2.imread(str(ROOT / row["mask"]), cv2.IMREAD_GRAYSCALE)
        return render(self.condition, crop, mask, row["id"], self.size)

    def __getitem__(self, idx):
        return to_tensor(self.image(idx)), int(self.df.iloc[idx]["label"])


class AllConditionsDataset(Dataset):
    """Every (condition, image) pair in one dataset, so one DataLoader covers the whole stress test."""

    def __init__(self, split_csv, size):
        self.parts = [StressDataset(split_csv, cond, size) for cond in CONDITIONS]
        self.n = len(self.parts[0])

    def __len__(self):
        return self.n * len(self.parts)

    def __getitem__(self, idx):
        k, i = divmod(idx, self.n)
        x, y = self.parts[k][i]
        return x, y, k
