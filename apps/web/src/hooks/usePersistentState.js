import { useEffect, useState } from 'react';

// Small localStorage-backed state helper used by the Phase 8 panels
// (custom indicators, webhooks, social/copy settings). Single-user app.
export default function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [key, value]);

  return [value, setValue];
}
