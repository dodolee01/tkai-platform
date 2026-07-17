import React from 'react';
import { AlertTriangle, RefreshCw, Inbox, Loader2 } from 'lucide-react';

/**
 * Theme-aware skeleton block. Uses a subtle shimmer that respects
 * `prefers-reduced-motion` (animation is disabled globally in that case).
 *
 * @param {object} props
 * @param {string} [props.className] extra Tailwind classes for sizing/shape.
 * @returns {JSX.Element}
 */
export function Skeleton({ className = '' }) {
    return (
        <div
            aria-hidden="true"
            className={`animate-pulse rounded-lg bg-white/[0.06] dark:bg-white/[0.06] ${className}`}
        />
    );
}

/**
 * Skeleton layout for a KPI / stat card grid.
 * @param {object} props
 * @param {number} [props.count=4] number of card placeholders.
 * @returns {JSX.Element}
 */
export function CardGridSkeleton({ count = 4 }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 space-y-3">
                    <Skeleton className="h-9 w-9 rounded-xl" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-3 w-16" />
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton layout for a data table.
 * @param {object} props
 * @param {number} [props.rows=6] body rows.
 * @param {number} [props.cols=5] columns per row.
 * @returns {JSX.Element}
 */
export function TableSkeleton({ rows = 6, cols = 5 }) {
    return (
        <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex gap-4">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className="h-5 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Centered loading state with spinner and optional label.
 * @param {object} props
 * @param {string} [props.label] text shown under the spinner.
 * @param {string} [props.className] extra classes for the wrapper.
 * @returns {JSX.Element}
 */
export function LoadingState({ label = 'Yükleniyor...', className = '' }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={`flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground ${className}`}
        >
            <Loader2 className="h-7 w-7 animate-spin text-primary" strokeWidth={2} />
            {label && <span className="text-sm">{label}</span>}
        </div>
    );
}

/**
 * Friendly empty state with an icon, message, and optional call-to-action.
 * @param {object} props
 * @param {React.ComponentType} [props.icon] lucide icon component.
 * @param {string} props.title primary heading.
 * @param {string} [props.description] supporting copy.
 * @param {string} [props.actionLabel] CTA button text.
 * @param {() => void} [props.onAction] CTA click handler.
 * @returns {JSX.Element}
 */
export function EmptyState({
    icon: Icon = Inbox,
    title,
    description,
    actionLabel,
    onAction,
}) {
    return (
        <div className="glass rounded-2xl flex flex-col items-center justify-center text-center gap-3 px-6 py-14">
            <span className="icon-badge h-12 w-12">
                <Icon className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
            {description && (
                <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
            )}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="gradient-btn mt-1 rounded-xl px-5 py-2.5 text-sm font-medium"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

/**
 * Error state with a clear message and a retry affordance.
 * @param {object} props
 * @param {string} [props.title] heading.
 * @param {string} [props.message] user-friendly description.
 * @param {() => void} [props.onRetry] retry handler; renders a button when set.
 * @returns {JSX.Element}
 */
export function ErrorState({
    title = 'Bir sorun oluştu',
    message = 'Veriler yüklenirken beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
    onRetry,
}) {
    return (
        <div
            role="alert"
            className="glass rounded-2xl flex flex-col items-center justify-center text-center gap-3 px-6 py-14"
        >
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="h-6 w-6" strokeWidth={1.6} />
            </span>
            <h3 className="font-display text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="mt-1 inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition hover:opacity-90"
                >
                    <RefreshCw className="h-4 w-4" /> Tekrar Dene
                </button>
            )}
        </div>
    );
}

export default { Skeleton, CardGridSkeleton, TableSkeleton, LoadingState, EmptyState, ErrorState };
