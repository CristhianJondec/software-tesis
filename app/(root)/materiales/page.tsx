import { BookOpenCheck, Download, FileText, ListChecks } from 'lucide-react';

import { listStudyMaterials } from '@/lib/actions/material.actions';
import { GUIDE_INTRO, GUIDE_SECTIONS, TOPIC_GUIDE } from '@/lib/materials/guide';
import { guardMaterialsPage } from '@/lib/study/access';

export const metadata = { title: 'Materiales — Investfied' };
export const dynamic = 'force-dynamic';

/**
 * The preparation dossier. It is the control arm's content screen and is not
 * available to experimental participants.
 */
function formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function MaterialsPage() {
    await guardMaterialsPage();

    const materialsResult = await listStudyMaterials();
    const materials = materialsResult.success ? materialsResult.data ?? [] : [];

    return (
        <main className="wrapper container">
            <header className="mb-10">
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">
                    Preparación de la sustentación
                </p>
                <h1 className="page-title-xl">Materiales</h1>
                <p className="subtitle mt-4 max-w-3xl">{GUIDE_INTRO}</p>
            </header>

            {materials.length > 0 && (
                <section className="mb-12" aria-labelledby="documentos">
                    <h2 id="documentos" className="mb-4 flex items-center gap-2 font-serif text-2xl font-bold text-[#212a3b]">
                        <FileText className="size-6 text-[#663820]" /> Documentos
                    </h2>
                    <ul className="grid gap-3 sm:grid-cols-2">
                        {materials.map((material) => (
                            <li key={material.id}>
                                <a
                                    href={`/api/materials/${material.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-full items-start gap-4 rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-[#663820]/40 hover:shadow-md"
                                >
                                    <span className="mt-0.5 rounded-lg bg-[#fff6e5] p-2 text-[#663820]">
                                        <Download className="size-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-serif text-lg font-bold text-[#212a3b]">{material.title}</span>
                                        {material.description && (
                                            <span className="mt-1 block text-sm text-[var(--text-secondary)]">{material.description}</span>
                                        )}
                                        <span className="mt-2 block text-xs text-[var(--text-secondary)]">
                                            PDF · {formatSize(material.fileSize)}
                                        </span>
                                    </span>
                                </a>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="mb-12" aria-labelledby="temas">
                <h2 id="temas" className="mb-2 flex items-center gap-2 font-serif text-2xl font-bold text-[#212a3b]">
                    <BookOpenCheck className="size-6 text-[#663820]" /> Las doce secciones que evalúa el jurado
                </h2>
                <p className="subtitle mb-6 max-w-3xl">
                    Para cada sección, ubica en tu documento dónde está la respuesta. Si no la encuentras, ahí tienes un vacío.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                    {TOPIC_GUIDE.map((topic, index) => (
                        <article key={topic.id} className="rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3e4c7] font-serif text-sm font-bold text-[#663820]">
                                    {index + 1}
                                </span>
                                <div>
                                    <h3 className="font-serif text-lg font-bold text-[#212a3b]">{topic.name}</h3>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{topic.description}</p>
                                </div>
                            </div>
                            <p className="mt-4 rounded-lg bg-[#fff6e5] px-3 py-2 text-sm text-[#663820]">
                                <strong>El jurado presiona en:</strong> {topic.focusHint}.
                            </p>
                            <ul className="mt-4 grid gap-2 text-sm">
                                {topic.questions.map((question) => (
                                    <li key={question} className="flex gap-2">
                                        <span aria-hidden="true" className="text-[#663820]">—</span>
                                        <span>{question}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>

            <section aria-labelledby="recomendaciones">
                <h2 id="recomendaciones" className="mb-6 flex items-center gap-2 font-serif text-2xl font-bold text-[#212a3b]">
                    <ListChecks className="size-6 text-[#663820]" /> Recomendaciones
                </h2>
                <div className="grid gap-4">
                    {GUIDE_SECTIONS.map((section) => (
                        <article key={section.id} className="rounded-xl border border-black/10 bg-white p-6 shadow-sm">
                            <h3 className="font-serif text-xl font-bold text-[#212a3b]">{section.title}</h3>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">{section.summary}</p>
                            <ul className="mt-4 grid gap-2.5 text-sm">
                                {section.items.map((item) => (
                                    <li key={item} className="flex gap-2.5">
                                        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#663820]" />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
