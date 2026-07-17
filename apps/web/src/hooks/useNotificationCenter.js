import { useCallback, useMemo } from 'react';
import pb from '@/lib/pocketbaseClient';
import useRealtimeSubscription from '@/hooks/useRealtimeSubscription';

/**
 * Realtime notification center backed by the PocketBase `notifications`
 * collection. Provides the live list, unread count, connection status and
 * mutation helpers (markRead / markAllRead / remove / clearAll).
 */
export default function useNotificationCenter() {
  const { records, status, refresh } = useRealtimeSubscription('notifications', { sort: '-created' });

  const unread = useMemo(() => records.filter((n) => !n.isRead).length, [records]);

  const markRead = useCallback(async (id) => {
    try {
      await pb.collection('notifications').update(id, { isRead: true });
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unreadOnes = records.filter((n) => !n.isRead);
    await Promise.all(
      unreadOnes.map((n, i) =>
        pb
          .collection('notifications')
          .update(n.id, { isRead: true }, { requestKey: `mark-${n.id}-${i}` })
          .catch(() => {}),
      ),
    );
  }, [records]);

  const remove = useCallback(async (id) => {
    try {
      await pb.collection('notifications').delete(id);
    } catch {
      /* ignore */
    }
  }, []);

  const clearAll = useCallback(async () => {
    await Promise.all(
      records.map((n, i) =>
        pb.collection('notifications').delete(n.id, { requestKey: `del-${n.id}-${i}` }).catch(() => {}),
      ),
    );
  }, [records]);

  return { notifications: records, unread, status, refresh, markRead, markAllRead, remove, clearAll };
}
