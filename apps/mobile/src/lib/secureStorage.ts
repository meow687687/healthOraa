import * as SecureStore from 'expo-secure-store';

// SecureStore keeps each value under about 2 KB. A Supabase session can be larger, so long values are
// split across numbered keys and a small manifest records how many parts exist.
const CHUNK_CHARS = 1800;
const MANIFEST_PREFIX = '__chunks:';

const partKey = (key: string, index: number): string => `${key}.part${index}`;

const readParts = async (key: string, count: number): Promise<string | null> => {
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await SecureStore.getItemAsync(partKey(key, index));
    if (part === null) return null;
    parts.push(part);
  }
  return parts.join('');
};

// Deletes parts from index `from` up to, not including, index `to`.
const deletePartsRange = async (key: string, from: number, to: number): Promise<void> => {
  for (let index = from; index < to; index += 1) {
    await SecureStore.deleteItemAsync(partKey(key, index));
  }
};

const manifestCount = (raw: string | null): number => {
  if (raw === null || !raw.startsWith(MANIFEST_PREFIX)) return 0;
  return Number(raw.slice(MANIFEST_PREFIX.length));
};

export const secureStorage = {
  // An unreadable stored session (locked keychain, damaged entry, no native store) counts as signed out.
  // Without this the auth client never reports a session and the app stays on its loading screen.
  async getItem(key: string): Promise<string | null> {
    try {
      const raw = await SecureStore.getItemAsync(key);
      const count = manifestCount(raw);
      if (count === 0) return raw;
      return await readParts(key, count);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const previous = manifestCount(await SecureStore.getItemAsync(key));
    if (value.length <= CHUNK_CHARS) {
      await SecureStore.setItemAsync(key, value);
      await deletePartsRange(key, 0, previous);
      return;
    }
    const chunks = Math.ceil(value.length / CHUNK_CHARS);
    for (let index = 0; index < chunks; index += 1) {
      await SecureStore.setItemAsync(partKey(key, index), value.slice(index * CHUNK_CHARS, (index + 1) * CHUNK_CHARS));
    }
    await SecureStore.setItemAsync(key, `${MANIFEST_PREFIX}${chunks}`);
    await deletePartsRange(key, chunks, previous);
  },

  async removeItem(key: string): Promise<void> {
    const count = manifestCount(await SecureStore.getItemAsync(key));
    await deletePartsRange(key, 0, count);
    await SecureStore.deleteItemAsync(key);
  },
};
