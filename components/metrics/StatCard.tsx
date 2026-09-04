import { cn } from '@/lib/utils';

/**
 * A single reported figure with its n underneath.
 *
 * `n` is not decoration: a mean over three turns and a mean over three hundred
 * are different claims, and the thesis has to show which one it is making.
 */
export interface StatCardProps {
    label: string;
    value: string;
    n?: number;
    hint?: string;
    className?: string;
}

export function StatCard({ label, value, n, hint, className }: StatCardProps) {
    return (
        <div className={cn('rounded-xl border border-black/10 bg-white p-5 shadow-soft-sm', className)}>
            <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-2 font-serif text-3xl font-semibold text-[#212a3b]">{value}</p>
            {n !== undefined && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">n = {n}</p>
            )}
            {hint && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>}
        </div>
    );
}

export function Section({
    title,
    formula,
    description,
    children,
}: {
    title: string;
    formula?: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mt-12">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h2 className="section-title">{title}</h2>
                {formula && (
                    <code className="text-sm text-[var(--text-secondary)]">{formula}</code>
                )}
            </div>
            {description && (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
                    {description}
                </p>
            )}
            <div className="mt-5">{children}</div>
        </section>
    );
}

/** Tables here are wide by nature; the wrapper keeps the page itself from scrolling sideways. */
export function TableWrapper({ children }: { children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-black/10 bg-white shadow-soft-sm">
            <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
        </div>
    );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
    return (
        <p className="rounded-xl border border-dashed border-black/20 bg-white/60 p-6 text-sm text-[var(--text-secondary)]">
            {children}
        </p>
    );
}
