import { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

// Per-user exchange API key management, isolated by PocketBase owner rules.
export function useApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!pb.authStore.record) return;
    setLoading(true);
    setError('');
    try {
      const list = await pb.collection('user_api_keys').getFullList({
        sort: '-created',
        requestKey: 'load-api-keys',
      });
      setKeys(list);
    } catch (err) {
      if (err?.status !== 0) setError('Anahtarlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addKey = useCallback(async (data) => {
    const rec = await pb.collection('user_api_keys').create({
      ...data,
      owner: pb.authStore.record.id,
    });
    setKeys((prev) => [rec, ...prev]);
    return rec;
  }, []);

  const updateKey = useCallback(async (id, data) => {
    const rec = await pb.collection('user_api_keys').update(id, data);
    setKeys((prev) => prev.map((k) => (k.id === id ? rec : k)));
    return rec;
  }, []);

  const removeKey = useCallback(async (id) => {
    await pb.collection('user_api_keys').delete(id);
    setKeys((prev) => prev.filter((k) => k.id !== id));
  }, []);

  return { keys, loading, error, reload: load, addKey, updateKey, removeKey };
}

export default useApiKeys;
