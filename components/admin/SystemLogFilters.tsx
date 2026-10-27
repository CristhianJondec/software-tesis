'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import {
    LOG_EVENT_OPTIONS,
    LOG_GROUP_OPTIONS,
    LOG_LEVEL_OPTIONS,
    LOG_SOURCE_OPTIONS,
    hasActiveLogFilters,
    serializeSystemLogFilters,
    type SystemLogFilters as Filters,
} from '@/lib/system-logs/filters';

const SEARCH_DEBOUNCE_MS = 300;

/** Filters of /admin/logs. State lives in the URL; any change goes back to page 1. */
export default function SystemLogFilters({ filters }: { filters: Filters }) {
    const router = useRouter();
    const pathname = usePathname();
    const [query, setQuery] = useState(filters.q);
    const [isPending, startTransition] = useTransition();

    const apply = (next: Partial<Filters>) => {
        const search = serializeSystemLogFilters({ ...filters, q: query.trim(), ...next, pagina: 1, paginaSesiones: 1 });
        startTransition(() => {
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        });
    };

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed === filters.q) return;
        const timer = setTimeout(() => apply({ q: trimmed }), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const fieldClass = 'w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm';

    return (
        <div className="mb-4 grid gap-3 rounded-xl border border-black/10 bg-white p-4 shadow-sm">
            <label className="relative min-w-0">
                <span className="sr-only">Buscar participante</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar participante por nombre, correo o código"
                    className="w-full rounded-lg border border-black/15 bg-white py-2 pr-3 pl-9 text-sm"
                />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <select
                    aria-label="Filtrar por grupo"
                    value={filters.grupo}
                    onChange={(event) => apply({ grupo: event.target.value as Filters['grupo'] })}
                    className={fieldClass}
                >
                    {LOG_GROUP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por nivel"
                    value={filters.nivel}
                    onChange={(event) => apply({ nivel: event.target.value as Filters['nivel'] })}
                    className={fieldClass}
                >
                    {LOG_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por fuente"
                    value={filters.fuente}
                    onChange={(event) => apply({ fuente: event.target.value as Filters['fuente'] })}
                    className={fieldClass}
                >
                    {LOG_SOURCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <select
                    aria-label="Filtrar por evento"
                    value={filters.evento}
                    onChange={(event) => apply({ evento: event.target.value as Filters['evento'] })}
                    className={fieldClass}
                >
                    {LOG_EVENT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                    Desde
                    <input
                        type="date"
                        value={filters.desde}
                        max={filters.hasta || undefined}
                        onChange={(event) => apply({ desde: event.target.value })}
                        className={fieldClass}
                    />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                    Hasta
                    <input
                        type="date"
                        value={filters.hasta}
                        min={filters.desde || undefined}
                        onChange={(event) => apply({ hasta: event.target.value })}
                        className={fieldClass}
                    />
                </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-secondary)]">
                <span>{isPending ? 'Filtrando…' : 'Fechas en hora de Lima.'}</span>
                {hasActiveLogFilters(filters) && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery('');
                            startTransition(() => router.replace(pathname, { scroll: false }));
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
