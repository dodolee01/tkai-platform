import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

/**
 * Header control that flips between light and dark themes.
 * Persists the choice via ThemeContext and is keyboard/tooltip accessible.
 */
export default function ThemeToggle({ className = '' }) {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const label = isDark ? 'Aydınlık moda geç' : 'Karanlık moda geç';
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={label}
            title={label}
            className={`grid h-9 w-9 place-items-center rounded-full border border-border bg-black/30 text-muted-foreground transition hover:text-primary hover:border-primary/40 ${className}`}
        >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
    );
}
