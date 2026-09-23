import Link from 'next/link';
import { ArrowRight, BookOpen, Target } from 'lucide-react';

import PreparationMap from '@/components/PreparationMap';
import { getAllBooks } from '@/lib/actions/book.actions';
import { getPreparationMap } from '@/lib/actions/preparation.actions';
import { guardInterventionPage } from '@/lib/study/access';

export const metadata = { title: 'Mapa de preparación — Investfied' };
export const dynamic = 'force-dynamic';

/**
 * Preparation map of one investigation (docs/propuestas/03).
 *
 * Scoped to a document because the four states only mean something against one
 * thesis: a topic is a gap in THIS document, and it was practised in THIS
 * document's sessions. Without `bookId` the page asks which one.
 */
export default async function PreparationPage({
    searchParams,
}: {
    searchParams: Promise<{ bookId?: string }>;
}) {
    await guardInterventionPage();

    const { bookId } = await searchParams;

    if (!bookId) {
        const booksResult = await getAllBooks();
        const investigations = booksResult.success ? (booksResult.data ?? []) : [];

        return (
            <main className="wrapper container">
                <div className="mx-auto max-w-3xl">
                    <Header />

                    {investigations.length === 0 ? (
                        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                            <BookOpen className="mx-auto size-10 text-[#8B7355]" />
                            <h2 className="mt-4 text-xl font-bold font-serif text-[#212a3b]">
                                Todavía no subiste tu investigación
                            </h2>
                            <p className="mt-2 text-sm text-[#3d485e]">
                                El mapa se arma sobre tu propio documento: sube tu avance y
                                practica una sesión para empezar a verlo.
                            </p>
                            <Link href="/books/new" className="btn-primary mt-6">
                                Subir mi investigación
                            </Link>
                        </div>
                    ) : (
                        <ul className="grid gap-3">
                            {investigations.map((investigation) => (
                                <li key={investigation.id}>
                                    <Link
                                        href={`/preparacion?bookId=${encodeURIComponent(investigation.id)}`}
                                        className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-colors hover:bg-[#fff6e5]"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-bold text-[#212a3b]">
                                                {investigation.title}
                                            </span>
                                            <span className="block truncate text-xs text-[#3d485e]">
                                                Por {investigation.author}
                                            </span>
                                        </span>
                                        <ArrowRight className="size-4 shrink-0 text-[#663820]" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </main>
        );
    }

    const result = await getPreparationMap(bookId);

    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <div className="mx-auto max-w-3xl">
                    <Header />
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {result.error ?? 'No se pudo cargar el mapa de preparación.'}
                    </div>
                </div>
            </main>
        );
    }

    const { book } = result.data;

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-4xl">
                <Header title={book.title} />

                <div className="mb-6 flex flex-wrap gap-3">
                    <Link
                        href={`/books/${book.slug}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                    >
                        Volver a la investigación
                    </Link>
                    <Link
                        href={`/history?bookId=${encodeURIComponent(book.id)}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                    >
                        Ver historial
                    </Link>
                </div>

                <PreparationMap data={result.data} />
            </div>
        </main>
    );
}

function Header({ title }: { title?: string }) {
    return (
        <div className="mb-8 flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#f3e4c7]">
                <Target className="size-6 text-[#663820]" />
            </div>
            <div className="min-w-0">
                <h1 className="text-3xl font-bold font-serif text-[#212a3b] sm:text-4xl">
                    Mapa de preparación
                </h1>
                <p className="mt-2 break-words text-[#3d485e]">
                    {title ? (
                        <>
                            Qué tan listo estás para sustentar <strong>{title}</strong>, y dónde
                            exactamente estás flojo.
                        </>
                    ) : (
                        'Elige la investigación cuyo mapa quieres revisar.'
                    )}
                </p>
            </div>
        </div>
    );
}
