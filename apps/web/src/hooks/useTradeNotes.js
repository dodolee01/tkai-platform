import { useState, useCallback } from 'react';

const KEY = 'ats.journal.notes.v1';

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

// Per-trade journal metadata (notes, tags, learning flag) persisted locally.
export function useTradeNotes() {
  const [notes, setNotes] = useState(loadNotes);

  const persist = useCallback((next) => {
    setNotes(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const getNote = useCallback((id) => notes[id] || { text: '', tags: [], learning: false }, [notes]);

  const setNote = useCallback((id, patch) => {
    setNotes((prev) => {
      const cur = prev[id] || { text: '', tags: [], learning: false };
      const next = { ...prev, [id]: { ...cur, ...patch } };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { notes, getNote, setNote, persist };
}
