import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'hacknation:dev-mode';

let enabled = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export async function loadDevMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  enabled = raw === '1';
  emit();
  return enabled;
}

export async function setDevMode(next: boolean): Promise<void> {
  enabled = next;
  emit();
  await AsyncStorage.setItem(KEY, next ? '1' : '0');
}

export function useDevMode(): [boolean, (next: boolean) => void] {
  const [on, setOn] = useState(enabled);

  useEffect(() => {
    const listener = () => setOn(enabled);
    listeners.add(listener);
    loadDevMode().catch(() => {});
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return [on, (next) => { setDevMode(next).catch(() => {}); }];
}
