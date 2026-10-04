"""Build train/val/test splits for classes 0-4 and a holdout of class-5 (mixed) leaves."""

import pandas as pd
from sklearn.model_selection import train_test_split

from .config import CLASSES, CROPS, CSV, FLAGS, IMAGES, MASKS, MIXED_CLASS, ROOT, SEED, SPLITS


def load_labels():
    df = pd.read_csv(CSV)
    df = df[df["id"].map(lambda i: (IMAGES / f"{i}.jpg").exists())].reset_index(drop=True)
    df["n_stresses"] = df[FLAGS].sum(axis=1)
    df["crop"] = df["id"].map(lambda i: str((CROPS / f"{i}.jpg").relative_to(ROOT)))
    df["mask"] = df["id"].map(lambda i: str((MASKS / f"{i}.png").relative_to(ROOT)))
    return df.rename(columns={"predominant_stress": "label"})


def make_splits(val_frac=0.15, test_frac=0.15, seed=SEED):
    df = load_labels()
    mixed = df[df["label"] == MIXED_CLASS]
    df = df[df["label"] < MIXED_CLASS].copy()
    df["class_name"] = df["label"].map(dict(enumerate(CLASSES)))

    train, rest = train_test_split(df, test_size=val_frac + test_frac, stratify=df["label"], random_state=seed)
    val, test = train_test_split(
        rest, test_size=test_frac / (val_frac + test_frac), stratify=rest["label"], random_state=seed
    )

    SPLITS.mkdir(parents=True, exist_ok=True)
    out = {"train": train, "val": val, "test": test, "mixed_holdout": mixed}
    for name, part in out.items():
        part.sort_values("id").to_csv(SPLITS / f"{name}.csv", index=False)
    return out
