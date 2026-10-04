import { Asset } from 'expo-asset';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import labelMap from '../../assets/model/labels.json';
import modelAsset from '../../assets/model/leaf_model.onnx';
import thresholds from '../../assets/model/thresholds.json';

// Must match ml/export/preprocess.json.
const SIZE = 256;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const INPUT = 'image';
const OUTPUT = 'probs';

export const LABELS: string[] = Object.keys(labelMap)
  .sort((a, b) => Number(a) - Number(b))
  .map((k) => (labelMap as Record<string, string>)[k]);

export type LeafStatus = 'confident' | 'possibly_multiple' | 'not_sure';

export type LeafPrediction = {
  probs: number[];
  top: number;
  label: string;
  status: LeafStatus;
  /** Preprocessing + inference time. */
  ms: number;
};

let sessionPromise: Promise<InferenceSession> | null = null;

function loadSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = Asset.fromModule(modelAsset);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      return InferenceSession.create(uri.replace(/^file:\/\//, ''));
    })().catch((e) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// The whole photo is fitted inside a white SIZE x SIZE square (no cropping), matching the
// training view of a leaf centred on white (ml/src/augment.py eval_view).
async function preprocess(uri: string): Promise<Float32Array> {
  const first = await ImageManipulator.manipulate(uri).renderAsync();
  const fit = SIZE / Math.max(first.width, first.height);
  const ctx = ImageManipulator.manipulate(uri).resize({
    width: Math.max(1, Math.round(first.width * fit)),
    height: Math.max(1, Math.round(first.height * fit)),
  });
  const img = await (await ctx.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
  if (!img.base64) throw new Error('Image manipulator returned no base64 data');

  const { data, width, height } = decode(base64ToBytes(img.base64), { useTArray: true, formatAsRGBA: true });
  const w = Math.min(width, SIZE);
  const h = Math.min(height, SIZE);
  const ox = Math.floor((SIZE - w) / 2);
  const oy = Math.floor((SIZE - h) / 2);

  const plane = SIZE * SIZE;
  const out = new Float32Array(3 * plane);
  for (let c = 0; c < 3; c++) out.fill((1 - MEAN[c]) / STD[c], c * plane, (c + 1) * plane);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * width + x) * 4;
      const dst = (y + oy) * SIZE + (x + ox);
      for (let c = 0; c < 3; c++) {
        out[c * plane + dst] = (data[src + c] / 255 - MEAN[c]) / STD[c];
      }
    }
  }
  return out;
}

export function statusFor(probs: number[]): LeafStatus {
  const order = probs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  const [[p1, i1], [p2, i2]] = order;
  if (p1 >= thresholds.min_conf) return 'confident';
  if (i1 !== 0 && i2 !== 0 && p2 >= thresholds.multi_conf && p1 + p2 >= thresholds.min_conf) {
    return 'possibly_multiple';
  }
  return 'not_sure';
}

export async function classifyLeaf(uri: string): Promise<LeafPrediction> {
  const session = await loadSession();
  const t0 = Date.now();
  const input = await preprocess(uri);
  const result = await session.run({ [INPUT]: new Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const ms = Date.now() - t0;
  const probs = Array.from(result[OUTPUT].data as Float32Array);
  const top = probs.indexOf(Math.max(...probs));
  return { probs, top, label: LABELS[top], status: statusFor(probs), ms };
}
