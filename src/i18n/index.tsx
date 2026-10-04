import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { sw } from './sw';

export type Lang = 'en' | 'sw';

const KEY = 'hacknation:lang';
const dictionaries = { en, sw };

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18n>({
  lang: 'sw',
  setLang: () => {},
  t: (key) => key,
});

function lookup(lang: Lang, key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) return (node as Record<string, unknown>)[part];
    return undefined;
  }, dictionaries[lang]);
  return typeof value === 'string' ? value : key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('sw');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw === 'en' || raw === 'sw') setLangState(raw);
    }).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang: (next) => {
      setLangState(next);
      AsyncStorage.setItem(KEY, next).catch(() => {});
    },
    t: (key, vars) => {
      const text = lookup(lang, key);
      if (!vars) return text;
      return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
    },
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Sample plant names, notes, and crop are stored as i18n keys. Free-typed notes stay as written. */
export function storedText(value: string, t: I18n['t']): string {
  return value.startsWith('samples.') ? t(value) : value;
}
