import { useCallback, useEffect, useState } from 'react';
import pb from '@/lib/pocketbaseClient';
import { BUILTIN_PROFILES, SETTINGS_MAP } from '@/lib/strategyProfiles';

const ACTIVE_KEY = 'ats.activeProfile.v1';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

export function useStrategyProfiles(setSettings) {
  const [profiles, setProfiles] = useState([]);
  const [activeKey, setActiveKey] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'balanced'; } catch { return 'balanced'; }
  });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const items = await pb.collection('strategy_profiles').getFullList({ sort: 'created' });
      setProfiles(items);
      return items;
    } catch {
      // Fallback to built-ins if PocketBase is unavailable.
      setProfiles(BUILTIN_PROFILES.map((p) => ({ ...p, id: p.key })));
      return [];
    }
  }, []);

  // Seed built-in profiles once, then load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await pb.collection('strategy_profiles').getFullList();
        const existing = new Set(items.map((p) => p.key));
        const missing = BUILTIN_PROFILES.filter((p) => !existing.has(p.key));
        if (missing.length) {
          await Promise.all(missing.map((p, i) =>
            pb.collection('strategy_profiles').create(
              { key: p.key, name: p.name, description: p.description, builtin: true, active: false, riskLevel: p.riskLevel, config: p.config },
              { requestKey: `seed-profile-${i}` },
            ).catch(() => {}),
          ));
        }
      } catch { /* offline — use fallback */ }
      if (cancelled) return;
      await reload();
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const activeProfile = profiles.find((p) => p.key === activeKey) || profiles[0] || null;

  // Apply active profile config to live settings.
  useEffect(() => {
    if (!activeProfile || !setSettings) return;
    const c = activeProfile.config || {};
    setSettings((s) => {
      const next = { ...s };
      SETTINGS_MAP.forEach((k) => { if (c[k] != null) next[k] = c[k]; });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeProfile?.id]);

  const selectProfile = useCallback((key) => {
    setActiveKey(key);
    try { localStorage.setItem(ACTIVE_KEY, key); } catch { /* ignore */ }
  }, []);

  const cloneProfile = useCallback(async (source, name) => {
    const key = `custom_${rand()}`;
    const rec = await pb.collection('strategy_profiles').create({
      key, name: name || `${source.name} (Kopya)`, description: source.description,
      builtin: false, active: false, riskLevel: source.riskLevel, config: source.config,
    });
    await reload();
    return rec;
  }, [reload]);

  const createCustom = useCallback(async ({ name, description, riskLevel, config }) => {
    const key = `custom_${rand()}`;
    const rec = await pb.collection('strategy_profiles').create({
      key, name, description, builtin: false, active: false, riskLevel, config,
    });
    await reload();
    return rec;
  }, [reload]);

  const updateProfile = useCallback(async (id, patch) => {
    await pb.collection('strategy_profiles').update(id, patch);
    await reload();
  }, [reload]);

  const deleteProfile = useCallback(async (profile) => {
    if (profile.builtin) return;
    await pb.collection('strategy_profiles').delete(profile.id);
    if (profile.key === activeKey) selectProfile('balanced');
    await reload();
  }, [reload, activeKey, selectProfile]);

  const resetProfile = useCallback(async (profile) => {
    const def = BUILTIN_PROFILES.find((p) => p.key === profile.key);
    if (!def) return;
    await pb.collection('strategy_profiles').update(profile.id, {
      name: def.name, description: def.description, riskLevel: def.riskLevel, config: def.config,
    });
    await reload();
  }, [reload]);

  return {
    profiles, activeProfile, activeKey, loading,
    selectProfile, cloneProfile, createCustom, updateProfile, deleteProfile, resetProfile, reload,
  };
}
