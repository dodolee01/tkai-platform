import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'tkai-theme';
const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {}, setTheme: () => {} });

/**
 * Resolve the initial theme: stored preference first, then the OS
 * `prefers-color-scheme` hint, defaulting to dark to match the app's identity.
 * @returns {'light'|'dark'}
 */
function getInitialTheme() {
    if (typeof window === 'undefined') return 'dark';
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch {
        /* localStorage unavailable — fall through to system preference */
    }
    if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
}

/**
 * Provides theme state to the tree and keeps the `light`/`dark` class on
 * <html> in sync so CSS variables and Tailwind resolve correctly.
 */
export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        root.style.colorScheme = theme;
        try {
            window.localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            /* ignore persistence failures */
        }
    }, [theme]);

    // Follow OS changes only while the user hasn't set an explicit preference.
    useEffect(() => {
        const mql = window.matchMedia?.('(prefers-color-scheme: light)');
        if (!mql) return undefined;
        const onChange = (e) => {
            try {
                if (window.localStorage.getItem(STORAGE_KEY)) return;
            } catch {
                /* ignore */
            }
            setThemeState(e.matches ? 'light' : 'dark');
        };
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, []);

    const setTheme = useCallback((next) => {
        setThemeState(next === 'light' ? 'light' : 'dark');
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

/**
 * Access the current theme and controls.
 * @returns {{theme:'light'|'dark', toggleTheme:()=>void, setTheme:(t:string)=>void}}
 */
export function useTheme() {
    return useContext(ThemeContext);
}

export default ThemeContext;
