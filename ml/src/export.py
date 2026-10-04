"""ONNX export (temperature-scaled softmax inside the graph) and int8 static quantization."""

import json
import time

import cv2
import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper
import pandas as pd
import torch
from onnxruntime.quantization import (CalibrationDataReader, CalibrationMethod, QuantFormat, QuantType,
                                      quantize_static)
from onnxruntime.quantization.shape_inference import quant_pre_process

from . import augment
from .config import CLASSES, ML, ROOT, SEED, SPLITS
from .dataset import MEAN, STD, to_tensor

EXPORT = ML / "export"
INPUT, OUTPUT = "image", "probs"


class Calibrated(torch.nn.Module):
    """Image (normalised, NCHW) -> 5 probabilities that sum to 1."""

    def __init__(self, model, temperature):
        super().__init__()
        self.model = model
        self.register_buffer("inv_t", torch.tensor(1.0 / temperature))

    def forward(self, x):
        return torch.softmax(self.model(x) * self.inv_t, dim=1)


def export_fp32(model, temperature, path, size=augment.SIZE):
    wrapped = Calibrated(model.cpu().eval(), temperature).eval()
    dummy = torch.randn(1, 3, size, size)
    torch.onnx.export(wrapped, (dummy,), str(path), input_names=[INPUT], output_names=[OUTPUT],
                      opset_version=17, dynamic_axes={INPUT: {0: "batch"}, OUTPUT: {0: "batch"}}, dynamo=False)
    return path


def calibration_images(n=300, size=augment.SIZE, seed=SEED):
    """Train-split images only: half clean eval view, half scenario-augmented home photos."""
    df = pd.read_csv(SPLITS / "train.csv").sample(n=n, random_state=seed)
    rng = np.random.default_rng(seed)
    out = []
    for k, (_, row) in enumerate(df.iterrows()):
        crop = cv2.cvtColor(cv2.imread(str(ROOT / row["crop"])), cv2.COLOR_BGR2RGB)
        mask = cv2.imread(str(ROOT / row["mask"]), cv2.IMREAD_GRAYSCALE)
        img = augment.eval_view(crop, mask, size) if k % 2 == 0 else augment.scenario(crop, mask, rng, size=size)
        out.append(to_tensor(img).numpy()[None])
    return out


class _Reader(CalibrationDataReader):
    def __init__(self, batches):
        self.it = iter(batches)

    def get_next(self):
        x = next(self.it, None)
        return None if x is None else {INPUT: x}


def quantize_int8(fp32_path, int8_path, batches, nodes_to_exclude=(), method=CalibrationMethod.MinMax, **kwargs):
    prep = fp32_path.with_name(fp32_path.stem + "_prep.onnx")
    quant_pre_process(str(fp32_path), str(prep))
    quantize_static(str(prep), str(int8_path), _Reader(batches), quant_format=QuantFormat.QDQ,
                    per_channel=True, weight_type=QuantType.QInt8, activation_type=QuantType.QUInt8,
                    calibrate_method=method, nodes_to_exclude=list(nodes_to_exclude), **kwargs)
    prep.unlink()
    return int8_path


def compress_weights(fp32_path, out_path, dtype="int8", int8_min_size=0):
    """Store Conv/Gemm weights as per-output-channel int8 (or fp16) and dequantize them inside the graph.

    Activations and arithmetic stay fp32, so this shrinks the file without the activation
    rounding that full int8 quantization introduces. With dtype="int8", weights with fewer than
    `int8_min_size` values are stored as fp16 instead.
    """
    model = onnx.load(str(fp32_path))
    g = model.graph
    inits = {i.name: i for i in g.initializer}
    new_nodes = []
    for node in g.node:
        if node.op_type in ("Conv", "Gemm") and node.input[1] in inits:
            w_name = node.input[1]
            w = numpy_helper.to_array(inits[w_name]).astype(np.float32)
            g.initializer.remove(inits.pop(w_name))
            if dtype == "int8" and w.size >= int8_min_size:
                scale = np.abs(w.reshape(w.shape[0], -1)).max(1) / 127.0
                scale[scale == 0] = 1.0
                q = np.clip(np.round(w / scale.reshape(-1, *[1] * (w.ndim - 1))), -127, 127).astype(np.int8)
                g.initializer.extend([numpy_helper.from_array(q, w_name + "_q"),
                                      numpy_helper.from_array(scale.astype(np.float32), w_name + "_scale"),
                                      numpy_helper.from_array(np.zeros(w.shape[0], np.int8), w_name + "_zp")])
                new_nodes.append(helper.make_node("DequantizeLinear", [w_name + "_q", w_name + "_scale", w_name + "_zp"],
                                                  [w_name], axis=0))
            else:
                g.initializer.append(numpy_helper.from_array(w.astype(np.float16), w_name + "_fp16"))
                new_nodes.append(helper.make_node("Cast", [w_name + "_fp16"], [w_name], to=TensorProto.FLOAT))
    nodes = new_nodes + list(g.node)
    del g.node[:]
    g.node.extend(nodes)
    onnx.checker.check_model(model)
    onnx.save(model, str(out_path))
    return out_path


def session(path, threads=1):
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = threads
    return ort.InferenceSession(str(path), opts, providers=["CPUExecutionProvider"])


def run(sess, x, batch=64):
    return np.concatenate([sess.run([OUTPUT], {INPUT: x[i:i + batch]})[0] for i in range(0, len(x), batch)])


def latency_ms(sess, size=augment.SIZE, n=100):
    x = np.random.default_rng(0).standard_normal((1, 3, size, size)).astype(np.float32)
    for _ in range(10):
        sess.run([OUTPUT], {INPUT: x})
    times = []
    for _ in range(n):
        t = time.perf_counter()
        sess.run([OUTPUT], {INPUT: x})
        times.append((time.perf_counter() - t) * 1000)
    return float(np.median(times))


def write_bundle(model_path, thresholds, report):
    EXPORT.mkdir(exist_ok=True)
    (EXPORT / "labels.json").write_text(json.dumps({str(i): c for i, c in enumerate(CLASSES)}, indent=2))
    (EXPORT / "preprocess.json").write_text(json.dumps({
        "input_name": INPUT, "output_name": OUTPUT, "input_shape": [1, 3, augment.SIZE, augment.SIZE],
        "layout": "NCHW", "color": "RGB", "scale": "pixel / 255",
        "mean": MEAN.tolist(), "std": STD.tolist(),
        "view": "leaf cut out, centred on a plain white canvas, long side ~95% of the frame, resized to 256x256 (src.augment.eval_view)",
        "output": "probabilities over labels.json classes, temperature scaling and softmax are inside the model",
    }, indent=2))
    (EXPORT / "thresholds.json").write_text(json.dumps(thresholds, indent=2))
    (EXPORT / "export_report.json").write_text(json.dumps(report, indent=2, default=float))
