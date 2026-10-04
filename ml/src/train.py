"""Training loop shared by the notebooks. Saves <run>_best.pt, <run>_last.pt and <run>.csv."""

import time

import pandas as pd
import torch
from sklearn.metrics import f1_score
from torch.utils.data import DataLoader

from .config import CLASSES, ML, SPLITS
from .dataset import LeafDataset
from .model import build_model

CHECKPOINTS = ML / "checkpoints"
RUNS = ML / "runs"

DEFAULTS = {
    "arch": "mobilenetv3_small_100",
    "aug": "scenario",
    "size": 256,
    "epochs": 20,
    "batch_size": 32,
    "lr": 5e-4,
    "weight_decay": 1e-4,
    "num_workers": 6,
    "seed": 42,
}


def get_device():
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


def make_loaders(config):
    kw = dict(num_workers=config["num_workers"], persistent_workers=True)
    train_ds = LeafDataset(SPLITS / "train.csv", mode=config["aug"], size=config["size"])
    val_ds = LeafDataset(SPLITS / "val.csv", mode="eval", size=config["size"])
    train_dl = DataLoader(train_ds, batch_size=config["batch_size"], shuffle=True, drop_last=True, **kw)
    val_dl = DataLoader(val_ds, batch_size=64, shuffle=False, **kw)
    return train_dl, val_dl


def class_weights(labels):
    counts = pd.Series(labels).value_counts().sort_index().values
    return torch.tensor(counts.sum() / (len(counts) * counts), dtype=torch.float32)


@torch.no_grad()
def predict(model, dl, device):
    model.eval()
    logits, labels = [], []
    for x, y in dl:
        logits.append(model(x.to(device)).cpu())
        labels.append(y)
    return torch.cat(logits), torch.cat(labels)


def train(config, log=print):
    config = {**DEFAULTS, **config}
    run = config["run"]
    CHECKPOINTS.mkdir(exist_ok=True)
    RUNS.mkdir(exist_ok=True)
    torch.manual_seed(config["seed"])
    device = get_device()

    train_dl, val_dl = make_loaders(config)
    model = build_model(config["arch"]).to(device)
    criterion = torch.nn.CrossEntropyLoss(weight=class_weights(train_dl.dataset.df["label"]).to(device))
    optimizer = torch.optim.AdamW(model.parameters(), lr=config["lr"], weight_decay=config["weight_decay"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config["epochs"] * len(train_dl))

    def save(path, epoch, acc, f1):
        torch.save({"model": model.state_dict(), "config": config, "classes": CLASSES,
                    "epoch": epoch, "val_acc": acc, "val_macro_f1": f1}, path)

    best_path, last_path = CHECKPOINTS / f"{run}_best.pt", CHECKPOINTS / f"{run}_last.pt"
    history, best_f1 = [], -1.0
    for epoch in range(1, config["epochs"] + 1):
        t = time.time()
        model.train()
        total, n = 0.0, 0
        for x, y in train_dl:
            x, y = x.to(device), y.to(device)
            loss = criterion(model(x), y)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()
            total += loss.item() * len(y)
            n += len(y)

        logits, labels = predict(model, val_dl, device)
        preds = logits.argmax(1)
        val_loss = criterion(logits.to(device), labels.to(device)).item()
        acc = (preds == labels).float().mean().item()
        f1 = f1_score(labels, preds, average="macro")
        history.append({"epoch": epoch, "train_loss": total / n, "val_loss": val_loss,
                        "val_acc": acc, "val_macro_f1": f1, "lr": optimizer.param_groups[0]["lr"]})
        pd.DataFrame(history).to_csv(RUNS / f"{run}.csv", index=False)

        marker = ""
        if f1 > best_f1:
            best_f1 = f1
            save(best_path, epoch, acc, f1)
            marker = "  <- best, saved"
        log(f"[{run}] epoch {epoch:2d}  train loss {total / n:.3f}  val loss {val_loss:.3f}  "
            f"val acc {acc:.3f}  val macro-F1 {f1:.3f}  ({time.time() - t:.0f}s){marker}")

    save(last_path, epoch, acc, f1)
    log(f"[{run}] best val macro-F1 {best_f1:.3f} -> {best_path.name}, {last_path.name}")
    return pd.DataFrame(history), best_path
