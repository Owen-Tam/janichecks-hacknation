import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LeafStatus } from './leafModel';

export type RecordStatus = 'pending' | 'confirmed' | 'sent';

export type Diagnosis = {
  label: string;
  status: LeafStatus;
  /** Second disease when status is possibly_multiple. */
  also?: string;
  probs?: number[];
};

export type Plant = {
  id: string;
  name: string;
  species: string;
  identifiedAt: string;
};

export type PlantRecord = {
  id: string;
  plantId: string;
  imageUri: string | null;
  date: string;
  status: RecordStatus;
  note: string;
  diagnosis?: Diagnosis;
};

export type FieldUser = {
  id: string;
  name: string;
  village: string;
  crop: string;
  plants: Plant[];
  records: PlantRecord[];
};

const KEY = 'hacknation:data:v3';

const coffee = 'Coffea arabica';

const seed: FieldUser[] = [
  {
    id: 'u1',
    name: 'Neema Juma',
    village: 'Ondera',
    crop: 'samples.crop',
    plants: [
      { id: 'p1', name: 'samples.plants.upper', species: coffee, identifiedAt: '2026-08-16' },
      { id: 'p2', name: 'samples.plants.shade', species: coffee, identifiedAt: '2026-09-01' },
      { id: 'p3', name: 'samples.plants.nursery', species: coffee, identifiedAt: '2026-03-02' },
    ],
    records: [
      {
        id: 'r1', plantId: 'p1', imageUri: 'sample:rust', date: '2026-09-20', status: 'sent',
        note: 'samples.notes.rust',
        diagnosis: { label: 'rust', status: 'confident' },
      },
      {
        id: 'r2', plantId: 'p2', imageUri: 'sample:leaf_miner', date: '2026-09-27', status: 'confirmed',
        note: 'samples.notes.miner',
        diagnosis: { label: 'leaf_miner', status: 'confident' },
      },
      {
        id: 'r3', plantId: 'p3', imageUri: 'sample:phoma', date: '2026-04-18', status: 'pending',
        note: 'samples.notes.phoma',
        diagnosis: { label: 'phoma', status: 'confident' },
      },
    ],
  },
  {
    id: 'u2',
    name: 'Joseph Mwangi',
    village: 'Kilele',
    crop: 'samples.crop',
    plants: [
      { id: 'p4', name: 'samples.plants.valley', species: coffee, identifiedAt: '2026-07-11' },
    ],
    records: [
      {
        id: 'r4', plantId: 'p4', imageUri: 'sample:cercospora', date: '2026-10-01', status: 'sent',
        note: 'samples.notes.cercospora',
        diagnosis: { label: 'cercospora', status: 'confident' },
      },
    ],
  },
  {
    id: 'u3',
    name: 'Amina Hassan',
    village: 'Kando ya Mto',
    crop: 'samples.crop',
    plants: [
      { id: 'p5', name: 'samples.plants.home', species: coffee, identifiedAt: '2026-09-08' },
    ],
    records: [
      {
        id: 'r5', plantId: 'p5', imageUri: 'sample:healthy', date: '2026-09-14', status: 'sent',
        note: 'samples.notes.healthy',
        diagnosis: { label: 'healthy', status: 'confident' },
      },
    ],
  },
];

export async function getUsers(): Promise<FieldUser[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    await AsyncStorage.setItem(KEY, JSON.stringify(seed));
    return seed;
  } catch {
    return seed;
  }
}

export async function saveUsers(users: FieldUser[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(users));
}

export async function updateUser(userId: string, fn: (u: FieldUser) => FieldUser): Promise<FieldUser[]> {
  const users = await getUsers();
  const next = users.map((u) => (u.id === userId ? fn(u) : u));
  await saveUsers(next);
  return next;
}

export function plantNameFor(user: FieldUser, plantId: string): string {
  return user.plants.find((p) => p.id === plantId)?.name ?? 'samples.unknownPlant';
}

export const CURRENT_USER_ID = 'u1';
