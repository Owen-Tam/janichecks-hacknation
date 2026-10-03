import cv2
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

from . import augment
from .config import ROOT

MEAN = np.array([0.485, 0.456, 0.406], np.float32)
STD = np.array([0.229, 0.224, 0.225], np.float32)


def to_tensor(img):
    """uint8 HxWx3 RGB -> normalised float CHW tensor (ImageNet mean/std)."""
    x = (img.astype(np.float32) / 255 - MEAN) / STD
    return torch.from_numpy(x.transpose(2, 0, 1).copy())


class LeafDataset(Dataset):
    """Cached BRACOL crops + masks. mode: "light" or "scenario" (training) or "eval"."""

    def __init__(self, split_csv, mode="eval", size=augment.SIZE):
        self.df = pd.read_csv(split_csv)
        self.mode = mode
        self.size = size
        self._rng = None

    def __len__(self):
        return len(self.df)

    def _load(self, row):
        crop = cv2.cvtColor(cv2.imread(str(ROOT / row["crop"])), cv2.COLOR_BGR2RGB)
        mask = cv2.imread(str(ROOT / row["mask"]), cv2.IMREAD_GRAYSCALE)
        return crop, mask

    def image(self, idx):
        row = self.df.iloc[idx]
        crop, mask = self._load(row)
        if self.mode == "eval":
            return augment.eval_view(crop, mask, self.size)
        if self._rng is None:
            # One stream per DataLoader worker, so augmentations differ across workers and epochs.
            self._rng = np.random.default_rng(torch.initial_seed() % 2**32)
        return augment.PIPELINES[self.mode](crop, mask, self._rng, size=self.size)

    def __getitem__(self, idx):
        return to_tensor(self.image(idx)), int(self.df.iloc[idx]["label"])
