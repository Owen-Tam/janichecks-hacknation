import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
    if (!raw) {
      await writeUsers(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as FieldUser[];
    // A previous web save may already be a multi-megabyte camera PNG.
    const slim = await photosForStorage(parsed);
    if (slim !== parsed) await writeUsers(slim);
    return slim;
  } catch {
    return seed;
  }
}

export async function saveUsers(users: FieldUser[]): Promise<void> {
  await writeUsers(await photosForStorage(users));
}

// Browser storage is about 5 MB. A webcam PNG data URL is larger than that on its own.
const MAX_PHOTO_EDGE = 640;
const MAX_DATA_URL_CHARS = 250_000;

async function photosForStorage(users: FieldUser[]): Promise<FieldUser[]> {
  if (Platform.OS !== 'web') return users;
  let changed = false;
  const next: FieldUser[] = [];
  for (const user of users) {
    const records: PlantRecord[] = [];
    for (const record of user.records) {
      const uri = record.imageUri;
      if (!uri || !shouldShrink(uri)) {
        records.push(record);
        continue;
      }
      changed = true;
      records.push({ ...record, imageUri: await shrinkWebPhoto(uri) });
    }
    next.push(changed ? { ...user, records } : user);
  }
  return changed ? next : users;
}

function shouldShrink(uri: string): boolean {
  if (uri.startsWith('blob:')) return true;
  return uri.startsWith('data:image') && uri.length > MAX_DATA_URL_CHARS;
}

function loadHtmlImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that photo.'));
    img.src = uri;
  });
}

async function shrinkWebPhoto(uri: string): Promise<string | null> {
  try {
    const img = await loadHtmlImage(uri);
    const edge = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const scale = Math.min(1, MAX_PHOTO_EDGE / edge);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const jpeg = canvas.toDataURL('image/jpeg', 0.65);
    return jpeg.length > MAX_DATA_URL_CHARS ? null : jpeg;
  } catch {
    return null;
  }
}

async function writeUsers(users: FieldUser[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(users));
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    const stripped = users.map((user) => ({
      ...user,
      records: user.records.map((record) =>
        record.imageUri && (record.imageUri.startsWith('data:') || record.imageUri.startsWith('blob:'))
          ? { ...record, imageUri: null }
          : record,
      ),
    }));
    await AsyncStorage.setItem(KEY, JSON.stringify(stripped));
  }
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  const message = 'message' in error ? String(error.message) : '';
  return name === 'QuotaExceededError' || message.includes('QuotaExceeded') || message.toLowerCase().includes('quota');
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
