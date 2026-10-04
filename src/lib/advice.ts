import adviceJson from '../../assets/advice.json';
import type { LeafStatus } from './leafModel';

export type AdviceSection = { heading: string; body: string; audio?: string };

export type AdviceReport = {
  title: string;
  audio?: string;
  sections: AdviceSection[];
};

type AdviceEntry = {
  title: string;
  audio?: string;
  sections: AdviceSection[];
  seasonal?: {
    months: number[];
    before?: string;
    heading: string;
    body: string;
    audio?: string;
  };
};

const ADVICE = adviceJson as Record<string, AdviceEntry>;

function dateFromIso(iso?: string): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function entryFor(label: string, status: LeafStatus): AdviceEntry {
  if (status === 'not_sure') return ADVICE.not_sure;
  return ADVICE[label] ?? ADVICE.unknown;
}

function withSeasonal(entry: AdviceEntry, dateIso?: string): AdviceSection[] {
  const seasonal = entry.seasonal;
  if (!seasonal || !seasonal.months.includes(dateFromIso(dateIso).getMonth() + 1)) {
    return entry.sections;
  }
  const extra = { heading: seasonal.heading, body: seasonal.body, audio: seasonal.audio };
  const at = seasonal.before ? entry.sections.findIndex((s) => s.heading === seasonal.before) : -1;
  if (at < 0) return [...entry.sections, extra];
  return [...entry.sections.slice(0, at), extra, ...entry.sections.slice(at)];
}

type Translate = (key: string) => string;

export function displayTitle(label: string, status: LeafStatus, t: Translate, also?: string): string {
  if (status === 'possibly_multiple' && also) {
    return `${t(entryFor(label, 'confident').title)} ${t('common.and')} ${t(entryFor(also, 'confident').title)}`;
  }
  return t(entryFor(label, status).title);
}

export function adviceFor(label: string, status: LeafStatus, t: Translate, dateIso?: string): AdviceReport {
  const entry = entryFor(label, status);
  const sections = withSeasonal(entry, dateIso).map((section) => ({
    ...section,
    heading: t(section.heading),
    body: t(section.body),
  }));
  return { title: t(entry.title), audio: entry.audio, sections };
}
