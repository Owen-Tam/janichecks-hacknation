"""Temperature scaling, calibration error and the confident / possibly_multiple / not_sure rule."""

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from .config import CLASSES, FLAGS
from .stress import CONDITIONS, AllConditionsDataset

STATUSES = ["confident", "possibly_multiple", "not_sure"]
FLAG_CLASS = {flag: k + 1 for k, flag in enumerate(FLAGS)}  # miner -> 1, rust -> 2, ...


@torch.no_grad()
def condition_logits(model, split_csv, size, device, num_workers=6):
    """Logits for every image of a split under every stress condition, in one DataLoader pass."""
    model.eval()
    ds = AllConditionsDataset(split_csv, size)
    logits, labels, cond = [], [], []
    for x, y, k in DataLoader(ds, batch_size=64, num_workers=num_workers):
        logits.append(model(x.to(device)).float().cpu())
        labels.append(y)
        cond.append(k)
    df = pd.concat([ds.parts[0].df] * len(CONDITIONS), ignore_index=True)
    df["condition"] = [list(CONDITIONS)[k] for k in torch.cat(cond).tolist()]
    df["seen"] = df["condition"].map(lambda c: CONDITIONS[c][0])
    return torch.cat(logits).numpy(), df


def softmax(logits, temperature=1.0):
    z = logits / temperature
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def fit_temperature(logits, labels):
    """Single scalar T minimising validation NLL (optimised in log space so T stays positive)."""
    logits, labels = torch.as_tensor(logits), torch.as_tensor(labels)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = torch.nn.functional.cross_entropy(logits / log_t.exp(), labels)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.detach().exp())


def nll(probs, labels):
    return float(-np.log(probs[np.arange(len(labels)), labels] + 1e-12).mean())


def ece(probs, labels, n_bins=15):
    conf, correct = probs.max(1), probs.argmax(1) == labels
    bins = np.minimum((conf * n_bins).astype(int), n_bins - 1)
    return float(sum(abs(correct[bins == b].mean() - conf[bins == b].mean()) * (bins == b).mean()
                     for b in range(n_bins) if (bins == b).any()))


def reliability(probs, labels, n_bins=10):
    conf, correct = probs.max(1), probs.argmax(1) == labels
    bins = np.minimum((conf * n_bins).astype(int), n_bins - 1)
    return pd.DataFrame([{"bin_mid": (b + 0.5) / n_bins, "confidence": conf[bins == b].mean(),
                          "accuracy": correct[bins == b].mean(), "n": int((bins == b).sum())}
                         for b in range(n_bins) if (bins == b).any()])


def tune_min_conf(probs, labels, target=0.95, grid=np.arange(0.30, 0.995, 0.01)):
    """Lowest threshold whose accepted predictions reach the target accuracy (= the most coverage)."""
    conf, correct = probs.max(1), probs.argmax(1) == labels
    curve = pd.DataFrame([{"min_conf": t, "coverage": (conf >= t).mean(),
                           "accuracy": correct[conf >= t].mean() if (conf >= t).any() else np.nan}
                          for t in grid])
    ok = curve[curve["accuracy"] >= target]
    return float(round(ok["min_conf"].iloc[0], 2)), curve


def status(probs, min_conf, multi_conf):
    """confident: top-1 >= min_conf.
    possibly_multiple: otherwise, if the top two are both diseases, the second has >= multi_conf
    and together they reach min_conf (two diseases explain the photo).
    not_sure: everything else."""
    order = np.argsort(-probs, 1)
    top1, top2 = order[:, 0], order[:, 1]
    p1 = probs[np.arange(len(probs)), top1]
    p2 = probs[np.arange(len(probs)), top2]
    multi = (top1 > 0) & (top2 > 0) & (p2 >= multi_conf) & (p1 + p2 >= min_conf)
    return np.where(p1 >= min_conf, "confident", np.where(multi, "possibly_multiple", "not_sure"))


def present_classes(df):
    """Per image, the set of disease classes BRACOL marks as present (healthy if none)."""
    out = []
    for _, row in df.iterrows():
        s = {FLAG_CLASS[f] for f in FLAGS if row[f] == 1}
        out.append(s or {0})
    return out


def summarise(probs, df, min_conf, multi_conf):
    """Accuracy, macro-F1 and status breakdown. `correct` is top-1 == BRACOL's predominant label."""
    from sklearn.metrics import f1_score

    labels = df["label"].to_numpy()
    preds = probs.argmax(1)
    st = status(probs, min_conf, multi_conf)
    correct = preds == labels
    conf_mask = st == "confident"
    return {
        "n": len(labels),
        "acc": float(correct.mean()),
        "macro_f1": float(f1_score(labels, preds, average="macro", labels=range(len(CLASSES)))),
        "confident": float(conf_mask.mean()),
        "possibly_multiple": float((st == "possibly_multiple").mean()),
        "not_sure": float((st == "not_sure").mean()),
        "acc_when_confident": float(correct[conf_mask].mean()) if conf_mask.any() else np.nan,
        "confident_wrong": float((conf_mask & ~correct).mean()),
    }
