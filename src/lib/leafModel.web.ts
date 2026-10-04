import { Asset } from 'expo-asset';
import * as ort from 'onnxruntime-web/wasm';
import modelAsset from '../../assets/model/leaf_model.onnx';
import { LABELS, statusFor, type LeafPrediction } from './leafShared';

export { LABELS, pairedDisease, secondLabel, statusFor } from './leafShared';
export type { LeafPrediction, LeafStatus } from './leafShared';

// Must match ml/export/preprocess.json and the phone preprocess in leafModel.ts.
const SIZE = 256;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const INPUT = 'image';
const OUTPUT = 'probs';

ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function loadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const asset = Asset.fromModule(modelAsset);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const bytes = await fetch(uri).then((response) => {
        if (!response.ok) throw new Error('Could not load the leaf model.');
        return response.arrayBuffer();
      });
      return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }
  return sessionPromise;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that photo.'));
    img.src = uri;
  });
}

// Fit the whole photo inside a white square, same view the phone uses.
async function preprocess(uri: string): Promise<Float32Array> {
  const img = await loadImage(uri);
  const fit = SIZE / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * fit));
  const h = Math.max(1, Math.round(img.naturalHeight * fit));
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read that photo.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(img, Math.floor((SIZE - w) / 2), Math.floor((SIZE - h) / 2), w, h);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const plane = SIZE * SIZE;
  const out = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const src = i * 4;
    for (let c = 0; c < 3; c++) {
      out[c * plane + i] = (data[src + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  return out;
}

export async function classifyLeaf(uri: string): Promise<LeafPrediction> {
  const session = await loadSession();
  const t0 = Date.now();
  const input = await preprocess(uri);
  const result = await session.run({ [INPUT]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const ms = Date.now() - t0;
  const probs = Array.from(result[OUTPUT].data as Float32Array);
  const top = probs.indexOf(Math.max(...probs));
  return { probs, top, label: LABELS[top], status: statusFor(probs), ms };
}
