import type { LeafStatus } from './leafModel';

export type AdviceSection = { heading: string; body: string };

export type AdviceReport = {
  title: string;
  sections: AdviceSection[];
};

const DISEASE: Record<string, { title: string; symptoms: string; early: string; late: string; seasonal?: string }> = {
  leaf_miner: {
    title: 'Leaf miner',
    symptoms:
      'Tiny transparent, pale yellow, or whitish winding mines appear underneath the leaf epidermis, brown or dark necrotic spots on the upper leaf surface',
    early:
      'Prune lightly infested branches and clear away fallen leaves immediately. Install light traps at night to catch adult moths before they can lay eggs on the leaves.',
    late:
      "Aggressively prune highly damaged branches to improve sunlight penetration and air circulation, which reduces the pest's preferred humid environment. Rake and deeply bury all fallen leaves",
  },
  rust: {
    title: 'Leaf rust',
    symptoms:
      'irregular shaped spots on upper leaf surfaces, connected with yellow to orange powdery lesions on the lower leaf surfaces',
    early:
      'Thin out the coffee tree canopy and manage shade trees. Increasing sunlight and air circulation helps dry out leaves faster, preventing the moist conditions spores need to grow. Apply balanced fertilizers high in nitrogen and potassium.',
    late:
      'Cut back severely defoliated or dying trees to force new, healthy vegetative growth. Safely remove and burn or deeply bury the heavily infected debris away from healthy plots.',
  },
  phoma: {
    title: 'Phoma',
    symptoms: 'dark lesions on young leaves, branch dieback, and flower or fruit decay',
    early:
      'Apply foliar fertilizers containing manganese, phosphorus (phosphites), and boron. Remove fallen leaf litter and debris to prevent the spores from splashing onto the leaves during rain',
    seasonal:
      "Since it's the end of rainy season, only one or two sprays with contact fungicides are needed, keeping an interval of 30 days in between.",
    late:
      'Prune away all dying branches and cut a few inches into healthy wood to ensure the infection is completely isolated. Safely burn the infected wood away from the plantation, and remember to disinfect the tools. Use systemic fungicides 3-4 times spaced 20 to 30 days apart.',
  },
  cercospora: {
    title: 'Cercospora leaf spot',
    symptoms:
      'small spots on leaves that have a tan to light brown center with a distinct reddish-purple or dark brown border',
    early:
      'Apply copper-based fungicides (such as copper oxychloride or Kocide) to protect new foliage re-growth and uninfected berries, especially after pruning or during rainy periods. Prune dense branches to improve air circulation and reduce canopy humidity, and avoid overhead watering.',
    late:
      'Remove and burn heavily infected twigs, branches, and affected berries. Then control weeds and avoid herbicide injury to reduce stress.',
  },
};

export function isAprilOrMay(date = new Date()): boolean {
  const month = date.getMonth() + 1;
  return month === 4 || month === 5;
}

function dateFromIso(iso?: string): Date {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function displayTitle(label: string, status: LeafStatus): string {
  if (status === 'not_sure') return 'Unsure';
  if (label === 'healthy') return 'Healthy';
  return DISEASE[label]?.title ?? label;
}

export function adviceFor(label: string, status: LeafStatus, dateIso?: string): AdviceReport {
  if (status === 'not_sure') {
    return {
      title: 'Unsure',
      sections: [{ heading: 'Next step', body: "I'm unsure about what this image shows. Please contact your extension officer." }],
    };
  }
  if (label === 'healthy') {
    return {
      title: 'Healthy',
      sections: [{ heading: 'Result', body: 'This leaf shows that the plant is healthy.' }],
    };
  }
  const d = DISEASE[label];
  if (!d) {
    return { title: label, sections: [{ heading: 'Result', body: 'No advice is available for this result.' }] };
  }
  const sections: AdviceSection[] = [
    { heading: 'Symptoms', body: d.symptoms },
    { heading: 'Early stage', body: d.early },
  ];
  if (d.seasonal && isAprilOrMay(dateFromIso(dateIso))) {
    sections.push({ heading: 'If detected in April/May', body: d.seasonal });
  }
  sections.push({ heading: 'Late stage', body: d.late });
  return { title: d.title, sections };
}
