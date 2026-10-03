from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_raw" / "leaf"
IMAGES = DATA / "images"
CSV = DATA / "dataset.csv"

ML = ROOT / "ml"
CACHE = ML / "cache"
CROPS = CACHE / "crops"
MASKS = CACHE / "masks"
CACHE_INDEX = CACHE / "index.csv"
SPLITS = ML / "splits"

CLASSES = ["healthy", "leaf_miner", "rust", "phoma", "cercospora"]
MIXED_CLASS = 5
FLAGS = ["miner", "rust", "phoma", "cercospora"]
SEED = 42
