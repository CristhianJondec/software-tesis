'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import {
    GROUP_FILTER_OPTIONS,
    PROGRESS_FILTER_OPTIONS,
    hasActiveFilters,
    serializeAdminFilters,
    type AdminFilters as Filters,
} from '@/lib/admin/filters';

const SEARCH_DEBOUNCE_MS = 300;

/** Search, group and progress filters for the participant list. State lives in the URL. */
export default function AdminFilters({ filters, shown, total }: { filters: Filters; shown: number; total: number }) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState(filters.q);
    const [isPending, startTransition] = useTransition();

    const apply = (next: Filters) => {
        const search = serializeAdminFilters(next);
        startTransition(() => {
            router.replace(search ? `${pathname}?${search}#participantes` : `${pathname}#participantes`, { scroll: false });
        });
    };

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed === filters.q) return;
        const timer = setTimeout(() => apply({ ...filters, q: trimmed }), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const selectClass = 'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm sm:w-auto';

    return (
        <div className="mb-4 grid gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Buscar participante</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar por nombre, correo o código"
                        className="w-full rounded-lg border border-black/15 bg-white py-2 pr-3 pl-9 text-sm"
                    />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:flex">
                    <select
                        aria-label="Filtrar por grupo"
                        value={filters.grupo}
                        onChange={(event) => apply({ ...filters, q: query.trim(), grupo: event.target.value as Filters['grupo'] })}
                        className={selectClass}
                    >
                        {GROUP_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select
                        aria-label="Filtrar por avance de encuestas"
                        value={filters.avance}
                        onChange={(event) => apply({ ...filters, q: query.trim(), avance: event.target.value as Filters['avance'] })}
                        className={selectClass}
                    >
                        {PROGRESS_FILTER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
                <span>
                    {isPending ? 'Filtrando…' : `Mostrando ${shown} de ${total} participantes`}
                </span>
                {hasActiveFilters(filters) && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            apply({ q: '', grupo: 'todos', avance: 'todos' });
                        }}
                        className="inline-flex items-center gap-1 font-semibold text-[#663820] hover:underline"
                    >
                        <X className="size-3.5" /> Limpiar filtros
                    </button>
                )}
            </div>
        </div>
    );
}
