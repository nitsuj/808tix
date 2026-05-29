import { Platform } from 'react-native';

type AuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

const memoryStore = new Map<string, string>();

const memoryStorage: AuthStorage = {
  getItem: (key) => memoryStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    memoryStore.delete(key);
  },
};

const webStorage: AuthStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.removeItem(key);
  },
};

let cachedStorage: AuthStorage | null = null;

export function getSupabaseAuthStorage(): AuthStorage {
  if (cachedStorage) {
    return cachedStorage;
  }

  if (Platform.OS !== 'web') {
    // Lazy-load to avoid pulling AsyncStorage into Expo web SSR bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const asyncStorage = require('@react-native-async-storage/async-storage').default as AuthStorage;
    cachedStorage = asyncStorage;
    return asyncStorage;
  }

  if (typeof window !== 'undefined') {
    cachedStorage = webStorage;
    return cachedStorage;
  }

  cachedStorage = memoryStorage;
  return cachedStorage;
}
