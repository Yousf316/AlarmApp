import {MMKV} from 'react-native-mmkv';

/**
 * Single app-wide key/value store (synchronous, JSI-backed).
 * MMKV v3 (TurboModule): v4 depends on Nitro, whose Swift/C++ interop cannot
 * import RN 0.78's glog headers on iOS.
 */
export const storage = new MMKV({id: 'prayer-alarms'});

export const getJSON = (key, fallback = null) => {
  const raw = storage.getString(key);
  if (raw == null) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const setJSON = (key, value) => {
  storage.set(key, JSON.stringify(value));
};

/** Monotonic integer ids (used as Android PendingIntent request codes). */
export const nextId = seqKey => {
  const next = (storage.getNumber(seqKey) ?? 0) + 1;
  storage.set(seqKey, next);
  return next;
};

export const ensureSeqAtLeast = (seqKey, value) => {
  if ((storage.getNumber(seqKey) ?? 0) < value) {
    storage.set(seqKey, value);
  }
};
