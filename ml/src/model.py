import timm
import torch

from .config import CLASSES

DEFAULT_ARCH = "mobilenetv3_small_100"


def build_model(arch=DEFAULT_ARCH, num_classes=len(CLASSES), pretrained=True):
    return timm.create_model(arch, pretrained=pretrained, num_classes=num_classes)


def load_checkpoint(path, device="cpu"):
    ckpt = torch.load(path, map_location=device, weights_only=False)
    model = build_model(ckpt["config"]["arch"], len(ckpt["classes"]), pretrained=False)
    model.load_state_dict(ckpt["model"])
    return model.to(device).eval(), ckpt
