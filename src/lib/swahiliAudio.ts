import type { LeafStatus } from './leafModel';
import cercosporaCondition from '../../swahili/cercospora/condition.mp3';
import cercosporaEarly from '../../swahili/cercospora/early.mp3';
import cercosporaLate from '../../swahili/cercospora/late.mp3';
import cercosporaSymptoms from '../../swahili/cercospora/symptoms.mp3';
import healthyClip from '../../swahili/healthy/healthy.mp3';
import minerCondition from '../../swahili/leaf_miner/condition.mp3';
import minerEarly from '../../swahili/leaf_miner/early.mp3';
import minerLate from '../../swahili/leaf_miner/late.mp3';
import minerSymptoms from '../../swahili/leaf_miner/symptoms.mp3';
import phomaCondition from '../../swahili/phoma/condition.mp3';
import phomaEarly from '../../swahili/phoma/early.mp3';
import phomaEarlyApril from '../../swahili/phoma/early_april.mp3';
import phomaLate from '../../swahili/phoma/late.mp3';
import phomaSymptoms from '../../swahili/phoma/symptoms.mp3';
import rustCondition from '../../swahili/rust/condition.mp3';
import rustEarly from '../../swahili/rust/early.mp3';
import rustLate from '../../swahili/rust/late.mp3';
import rustSymptoms from '../../swahili/rust/symptoms.mp3';
import unsureClip from '../../swahili/unsure/unsure.mp3';

const CLIPS: Record<string, Record<string, number>> = {
  leaf_miner: { condition: minerCondition, symptoms: minerSymptoms, early: minerEarly, late: minerLate },
  rust: { condition: rustCondition, symptoms: rustSymptoms, early: rustEarly, late: rustLate },
  phoma: {
    condition: phomaCondition,
    symptoms: phomaSymptoms,
    early: phomaEarly,
    early_april: phomaEarlyApril,
    late: phomaLate,
  },
  cercospora: {
    condition: cercosporaCondition,
    symptoms: cercosporaSymptoms,
    early: cercosporaEarly,
    late: cercosporaLate,
  },
  healthy: { healthy: healthyClip },
  unsure: { unsure: unsureClip },
};

export function clipFor(label: string, status: LeafStatus, key: string): number | null {
  const folder = status === 'not_sure' ? 'unsure' : label;
  return CLIPS[folder]?.[key] ?? null;
}
