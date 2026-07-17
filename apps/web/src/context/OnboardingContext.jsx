import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const KEY = 'tkai.onboarding.v1';
const OnboardingContext = createContext(null);

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { completed: false, dismissed: false, data: {} };
}

export function OnboardingProvider({ children }) {
    const [state, setState] = useState(load);
    const [open, setOpen] = useState(false);

    // Show automatically on first visit (never completed / dismissed).
    useEffect(() => {
        if (!state.completed && !state.dismissed) {
            const t = setTimeout(() => setOpen(true), 600);
            return () => clearTimeout(t);
        }
    }, [state.completed, state.dismissed]);

    const persist = useCallback((next) => {
        setState(next);
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }, []);

    const openOnboarding = useCallback(() => setOpen(true), []);
    const closeOnboarding = useCallback(() => setOpen(false), []);
    const dismiss = useCallback(() => { persist({ ...state, dismissed: true }); setOpen(false); }, [persist, state]);
    const complete = useCallback((data) => { persist({ completed: true, dismissed: true, data }); setOpen(false); }, [persist]);
    const reset = useCallback(() => persist({ completed: false, dismissed: false, data: {} }), [persist]);

    return (
        <OnboardingContext.Provider value={{ state, open, openOnboarding, closeOnboarding, dismiss, complete, reset }}>
            {children}
        </OnboardingContext.Provider>
    );
}

export function useOnboarding() {
    const ctx = useContext(OnboardingContext);
    if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
    return ctx;
}
