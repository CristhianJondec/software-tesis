import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Previous / next links with "Página X de Y". Pages live in the URL, so each
 * caller builds its own hrefs (keeping its filters) through `href`.
 * Renders nothing when everything fits in one page.
 */
export default function PaginationNav({
    page,
    pageSize,
    total,
    href,
    previousLabel = 'Anterior',
    nextLabel = 'Siguiente',
}: {
    page: number;
    pageSize: number;
    total: number;
    href: (page: number) => string;
    previousLabel?: string;
    nextLabel?: string;
}) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    if (pageCount <= 1) return null;
    const current = Math.min(page, pageCount);
    const linkClass = 'inline-flex items-center gap-1 font-semibold text-[#663820] hover:underline';

    return (
        <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Paginación">
            {current > 1 ? (
                <Link href={href(current - 1)} scroll={false} className={linkClass}>
                    <ChevronLeft className="size-4" /> {previousLabel}
                </Link>
            ) : <span />}
            <span className="text-[var(--text-secondary)]">
                Página {current} de {pageCount}
            </span>
            {current < pageCount ? (
                <Link href={href(current + 1)} scroll={false} className={linkClass}>
                    {nextLabel} <ChevronRight className="size-4" />
                </Link>
            ) : <span />}
        </nav>
    );
}
