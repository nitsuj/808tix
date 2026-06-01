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

/**
 * Web auth storage must read/write localStorage at call time.
 * Caching memory storage during SSR/static export broke login (sessions never persisted).
 */
const webAuthStorage: AuthStorage = {
  getItem: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStore.get(key) ?? null;
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    memoryStore.set(key, value);
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
      return;
    }
    memoryStore.delete(key);
  },
};

let nativeStorage: AuthStorage | null = null;

export function getSupabaseAuthStorage(): AuthStorage {
  if (Platform.OS !== 'web') {
    if (!nativeStorage) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      nativeStorage = require('@react-native-async-storage/async-storage').default as AuthStorage;
    }
    return nativeStorage;
  }

  return webAuthStorage;
}
