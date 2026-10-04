import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecordStatus = 'pending' | 'confirmed' | 'sent';

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
};

export type FieldUser = {
  id: string;
  name: string;
  village: string;
  crop: string;
  plants: Plant[];
  records: PlantRecord[];
};

const KEY = 'hacknation:data:v2';

const seed: FieldUser[] = [
  {
    id: 'u1',
    name: 'Asha Patel',
    village: 'Kijani',
    crop: 'Mpunga',
    plants: [
      { id: 'p1', name: 'Mmea wa Mpunga A', species: 'Oryza sativa', identifiedAt: '2026-09-12' },
      { id: 'p2', name: 'Mmea wa Mpunga B', species: 'Oryza sativa', identifiedAt: '2026-09-20' },
    ],
    records: [
      { id: 'r1', plantId: 'p1', imageUri: null, date: '2026-09-28', status: 'sent', note: 'Majani yenye afya, kupalilia vizuri.' },
      { id: 'r2', plantId: 'p2', imageUri: null, date: '2026-09-30', status: 'confirmed', note: 'Majani ya chini yameanza kuwa ya manjano.' },
      { id: 'r3', plantId: 'p1', imageUri: null, date: '2026-10-02', status: 'pending', note: 'Picha mpya imepigwa leo.' },
    ],
  },
  {
    id: 'u2',
    name: 'Bekele Abebe',
    village: 'Kando ya Mto',
    crop: 'Mpunga',
    plants: [
      { id: 'p3', name: 'Mpunga wa Shamba 1', species: 'Oryza sativa', identifiedAt: '2026-09-05' },
    ],
    records: [
      { id: 'r4', plantId: 'p3', imageUri: null, date: '2026-10-01', status: 'sent', note: 'Kuvu ya madoa ya kahawia kumeonekana.' },
    ],
  },
  {
    id: 'u3',
    name: 'Mei Lin',
    village: 'Kilele',
    crop: 'Mpunga',
    plants: [],
    records: [],
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
  return user.plants.find((p) => p.id === plantId)?.name ?? 'Mmea usiojulikana';
}

export const CURRENT_USER_ID = 'u1';
