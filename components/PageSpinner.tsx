import { Loader2 } from 'lucide-react';

/**
 * Route-level loading state. Every view has a `loading.tsx` that renders this,
 * so navigating shows the spinner immediately while the server renders the page.
 */
export default function PageSpinner() {
    return (
        <main className="wrapper container flex min-h-[60vh] items-center justify-center" aria-busy="true">
            <div role="status" className="flex flex-col items-center gap-3 text-[#663820]">
                <Loader2 className="size-10 animate-spin" aria-hidden="true" />
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Cargando…</span>
            </div>
        </main>
    );
}
