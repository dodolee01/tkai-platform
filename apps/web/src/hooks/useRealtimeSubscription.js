import { useEffect, useRef, useState } from 'react';
import pb from '@/lib/pocketbaseClient';

/**
 * Subscribe to a PocketBase collection's realtime changes.
 *
 * @param {string} collection  collection name
 * @param {object} options
 *   - filter:   PB filter string for the initial getFullList
 *   - sort:     PB sort string (default '-created')
 *   - onEvent:  optional callback(e) fired on every realtime event
 *   - enabled:  whether the subscription is active (default true)
 *
 * Returns { records, status, error, refresh } where status is
 * 'connecting' | 'connected' | 'error'.
 */
export default function useRealtimeSubscription(collection, options = {}) {
  const { filter, sort = '-created', onEvent, enabled = true } = options;
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const refresh = useRef(() => {});

  useEffect(() => {
    if (!enabled || !collection) return undefined;
    let active = true;
    setStatus('connecting');

    const load = async () => {
      try {
        const opts = { sort };
        if (filter) opts.filter = filter;
        const list = await pb.collection(collection).getFullList(opts);
        if (active) {
          setRecords(list);
          setError(null);
        }
      } catch (err) {
        if (active && err?.status !== 0) setError(err);
      }
    };
    refresh.current = load;

    pb.collection(collection)
      .subscribe('*', (e) => {
        if (!active) return;
        setRecords((prev) => {
          if (e.action === 'create') {
            if (prev.some((r) => r.id === e.record.id)) return prev;
            return [e.record, ...prev];
          }
          if (e.action === 'update') return prev.map((r) => (r.id === e.record.id ? e.record : r));
          if (e.action === 'delete') return prev.filter((r) => r.id !== e.record.id);
          return prev;
        });
        onEventRef.current?.(e);
      })
      .then(() => {
        if (active) setStatus('connected');
      })
      .catch((err) => {
        if (active) {
          setStatus('error');
          setError(err);
        }
      });

    load();

    return () => {
      active = false;
      pb.collection(collection).unsubscribe('*');
    };
  }, [collection, filter, sort, enabled]);

  return { records, status, error, refresh: () => refresh.current() };
}
