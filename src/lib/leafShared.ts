import labelMap from '../../assets/model/labels.json';
import thresholds from '../../assets/model/thresholds.json';

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

export function secondLabel(probs: number[]): string | undefined {
  const order = probs.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  const index = order[1]?.[1];
  return index == null ? undefined : LABELS[index];
}

export function pairedDisease(status: LeafStatus, also?: string, probs?: number[]): string | undefined {
  if (status !== 'possibly_multiple') return undefined;
  return also ?? (probs ? secondLabel(probs) : undefined);
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
