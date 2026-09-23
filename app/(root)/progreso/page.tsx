import Link from 'next/link';
import { ArrowRight, BookOpen, LineChart, Sparkle, TrendingUp } from 'lucide-react';

import ProgressCharts from '@/components/ProgressCharts';
import { getAllBooks } from '@/lib/actions/book.actions';
import { getProgressOverview } from '@/lib/actions/progress.actions';
import { guardInterventionPage } from '@/lib/study/access';

export const metadata = { title: 'Mi progreso — Investfied' };
export const dynamic = 'force-dynamic';

/**
 * The progress view (docs/propuestas/05).
 *
 * Scoped to a document, like the preparation map: "sesión 3 comparada con sesión
 * 1" only means something when both sessions defended the same investigation.
 * Without `bookId` the page asks which one.
 *
 * WHAT IS DELIBERATELY ABSENT: the STAI and PRCS-12 scores. The proposal forbids
 * showing them to the student during the intervention because seeing them
 * contaminates the T2 measurement. The 0-10 self-report IS shown — it is the
 * student's own answer, given twice per session, and it is what the adaptation
 * rule already reports back to them on the pre-session screen.
 */
export default async function ProgressPage({
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
                            <h2 className="mt-4 font-serif text-xl font-bold text-[#212a3b]">
                                Todavía no subiste tu investigación
                            </h2>
                            <p className="mt-2 text-sm text-[#3d485e]">
                                El progreso se mide entre sesiones del mismo documento: sube tu
                                avance y practica una sustentación para empezar a verlo.
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
                                        href={`/progreso?bookId=${encodeURIComponent(investigation.id)}`}
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

    const result = await getProgressOverview(bookId);

    if (!result.success || !result.data) {
        return (
            <main className="wrapper container">
                <div className="mx-auto max-w-3xl">
                    <Header />
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {result.error ?? 'No se pudo cargar tu progreso.'}
                    </div>
                </div>
            </main>
        );
    }

    const { book, series, latest, sessionCount, unevaluatedAnswers } = result.data;

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-5xl">
                <Header title={book.title} />

                <div className="mb-6 flex flex-wrap gap-3">
                    <Link
                        href={`/books/${book.slug}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                    >
                        Volver a la investigación
                    </Link>
                    <Link
                        href={`/preparacion?bookId=${encodeURIComponent(book.id)}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                    >
                        Mapa de preparación
                    </Link>
                    <Link
                        href={`/history?bookId=${encodeURIComponent(book.id)}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                    >
                        Ver historial
                    </Link>
                </div>

                {sessionCount === 0 ? (
                    <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                        <LineChart className="mx-auto size-10 text-[#8B7355]" />
                        <h2 className="mt-4 font-serif text-xl font-bold text-[#212a3b]">
                            Todavía no hay sesiones que comparar
                        </h2>
                        <p className="mt-2 text-sm text-[#3d485e]">
                            Practica una sustentación con este documento. Desde la segunda sesión,
                            cada medición se compara con la anterior.
                        </p>
                        <Link href={`/books/${book.slug}`} className="btn-primary mt-6">
                            Practicar ahora
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {latest && (
                            <section className="rounded-2xl bg-white p-5 sm:p-6">
                                <div className="mb-4 flex items-start gap-3">
                                    <span className="rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                                        <Sparkle className="size-5" aria-hidden="true" />
                                    </span>
                                    <div>
                                        <h2 className="font-serif text-xl font-bold text-[#212a3b]">
                                            Lo que lograste en tu última sesión
                                        </h2>
                                        <p className="mt-1 text-sm leading-6 text-[#3d485e]">
                                            Sesión {latest.sessionNumber} de {sessionCount}. Cada
                                            línea cita un número registrado durante la conversación;
                                            ninguna la redacta un modelo, y una mejora solo aparece
                                            cuando la misma medición existe en las dos sesiones.
                                        </p>
                                    </div>
                                </div>

                                {latest.evidence.length === 0 ? (
                                    <p className="rounded-xl border border-[var(--border-subtle)] bg-[#f9fafb] p-4 text-sm text-[#3d485e]">
                                        Tu última sesión no registró respuestas, así que no hay
                                        avances que respaldar con datos.
                                    </p>
                                ) : (
                                    <ul className="space-y-3">
                                        {latest.evidence.map((item) => (
                                            <li
                                                key={item.id}
                                                className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-white p-4"
                                            >
                                                <span className="mt-0.5 shrink-0 rounded-lg bg-[#f3e4c7] p-2 text-[#663820]">
                                                    <TrendingUp className="size-4" aria-hidden="true" />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-sm leading-6 text-[#212a3b]">
                                                        {item.text}
                                                    </p>
                                                    <p className="mt-1 text-xs text-[#6b7280]">
                                                        {item.kind === 'improvement'
                                                            ? 'Mejora respecto a la sesión anterior'
                                                            : 'Logro registrado en esa sesión'}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <Link
                                    href={`/history/${latest.sessionId}?bookId=${encodeURIComponent(book.id)}#evidencias`}
                                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#663820] hover:underline"
                                >
                                    Ver el detalle de esa sesión
                                    <ArrowRight className="size-4" />
                                </Link>
                            </section>
                        )}

                        <section>
                            <h2 className="font-serif text-xl font-bold text-[#212a3b]">
                                Evolución sesión a sesión
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-[#3d485e]">
                                Cada serie se lee por separado: los segundos, la rúbrica de 0 a 3 y
                                la escala de 0 a 10 no comparten eje y no se combinan en un puntaje
                                único. Una sesión sin medición deja un hueco en la línea, nunca un
                                cero.
                                {unevaluatedAnswers > 0 &&
                                    ` Quedan ${unevaluatedAnswers} respuestas sin evaluar: las series de contenido y claridad se completan cuando las evalúes en el informe de cada sesión.`}
                            </p>

                            <div className="mt-4">
                                <ProgressCharts series={series} />
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}

function Header({ title }: { title?: string }) {
    return (
        <div className="mb-8 flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#f3e4c7]">
                <LineChart className="size-6 text-[#663820]" />
            </div>
            <div className="min-w-0">
                <h1 className="font-serif text-3xl font-bold text-[#212a3b] sm:text-4xl">
                    Mi progreso
                </h1>
                <p className="mt-2 break-words text-[#3d485e]">
                    {title ? (
                        <>
                            Cómo evolucionaron tus sesiones de <strong>{title}</strong>, con el dato
                            que respalda cada avance.
                        </>
                    ) : (
                        'Elige la investigación cuyo progreso quieres revisar.'
                    )}
                </p>
            </div>
        </div>
    );
}
