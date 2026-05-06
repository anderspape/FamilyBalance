"use client";

type CacheEntry<T> = {
  value: T;
  savedAt: number;
};

const cachePrefix = "familybalance:";

function storageKey(key: string) {
  return `${cachePrefix}${key}`;
}

export function readClientCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry.savedAt || Date.now() - entry.savedAt > maxAgeMs) {
      window.sessionStorage.removeItem(storageKey(key));
      return null;
    }

    return entry.value;
  } catch {
    return null;
  }
}

export function writeClientCache<T>(key: string, value: T) {
  try {
    window.sessionStorage.setItem(
      storageKey(key),
      JSON.stringify({ value, savedAt: Date.now() } satisfies CacheEntry<T>),
    );
  } catch {
    // Storage can be unavailable in private windows; the app should still work.
  }
}

export function clearClientCache(scope?: string) {
  try {
    const prefix = storageKey(scope ?? "");

    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(prefix)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Best-effort cache invalidation.
  }
}
