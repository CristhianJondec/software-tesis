import { ArrowDownRight, Quote, Sparkle, TrendingUp } from 'lucide-react';

import { DIFFICULTY_LEVELS } from '@/lib/difficulty/levels';
import type { ProgressEvidence as Evidence } from '@/lib/progress/evidence';
import type { SessionEvidenceData } from '@/lib/actions/progress.actions';

/**
 * The achievements panel of a closed session (docs/propuestas/05).
 *
 * Every line here comes out of `lib/progress/evidence.ts` already written: this
 * component may format, order and label, but it must never compose a sentence of
 * its own. The proposal forbids "¡Excelente trabajo!" and its relatives by name,
 * and the only way to keep that guarantee is for the prose to have exactly one
 * origin.
 *
 * It also never hides a regression: `setback` is rendered when there is one, with
 * its numbers, before the student is offered a lower level.
 */

const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
});

function EvidenceItem({ item }: { item: Evidence }) {
    const isImprovement = item.kind === 'improvement';
    const Icon = isImprovement ? TrendingUp : Sparkle;

    return (
        <li
            className={`flex items-start gap-3 rounded-xl border p-4 ${
                isImprovement ? 'border-[#c8dcd0] bg-[#fbfefc]' : 'border-[var(--border-subtle)] bg-white'
            }`}
        >
            <span
                className={`mt-0.5 shrink-0 rounded-lg p-2 ${
                    isImprovement ? 'bg-[#eef6f1] text-[#1f4434]' : 'bg-[#f3e4c7] text-[#663820]'
                }`}
            >
                <Icon className="size-4" aria-hidden="true" />
            </span>

            <div className="min-w-0">
                <p className="text-sm leading-6 text-[#212a3b]">{item.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
                    <span className="rounded-full border border-black/10 bg-white px-2 py-0.5 font-semibold text-[#212a3b]">
                        {item.datum}
                    </span>
                    <span>
                        {isImprovement
                            ? 'Mejora respecto a tu sesión anterior'
                            : 'Logro registrado en esta sesión'}
                    </span>
                </p>
            </div>
        </li>
    );
}

export default function ProgressEvidence({ data }: { data: SessionEvidenceData }) {
    const { evidence, setback, hasComparison, closing } = data;
    const improvements = evidence.filter((item) => item.kind === 'improvement').length;
    const suggested = setback?.suggestedLevel ? DIFFICULTY_LEVELS[setback.suggestedLevel] : null;

    return (
        <div className="space-y-5">
            <p className="text-sm text-[#3d485e]">
                {hasComparison
                    ? `Sesión ${data.sessionNumber} de esta investigación. Las comparaciones son contra tu sesión anterior con el mismo documento.`
                    : `Sesión ${data.sessionNumber} de esta investigación. Todavía no hay una sesión anterior con la que comparar, así que abajo van únicamente logros de esta.`}
            </p>

            {hasComparison && improvements === 0 && (
                <p className="rounded-xl border border-[var(--border-subtle)] bg-[#f9fafb] p-4 text-sm text-[#3d485e]">
                    Ninguna de las mediciones de esta sesión superó a las de la anterior por encima
                    del margen que el sistema considera significativo, así que no se reporta ninguna
                    mejora. Lo que sigue son logros de esta sesión.
                </p>
            )}

            {evidence.length === 0 ? (
                <p className="rounded-xl border border-[var(--border-subtle)] bg-white p-5 text-sm text-[#3d485e]">
                    Esta sesión no registró respuestas tuyas, así que no hay ningún avance que
                    respaldar con datos.
                </p>
            ) : (
                <ul className="space-y-3">
                    {evidence.map((item) => (
                        <EvidenceItem key={item.id} item={item} />
                    ))}
                </ul>
            )}

            {setback && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 rounded-lg bg-amber-100 p-2 text-amber-900">
                            <ArrowDownRight className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-amber-950">
                                Esto bajó respecto a tu sesión anterior
                            </p>
                            <p className="mt-1 text-sm leading-6 text-amber-950">{setback.text}</p>
                            <p className="mt-2 text-sm leading-6 text-amber-950">
                                {suggested
                                    ? `Si quieres, la próxima sesión puedes bajar al nivel ${suggested.id} — ${suggested.name} — desde la pantalla previa al simulacro.`
                                    : 'Esta sesión ya corrió en el nivel más bajo de exigencia, así que no hay uno menor al que bajar.'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {data.unevaluatedAnswers > 0 && (
                <p className="text-xs text-[#6b7280]">
                    {data.unevaluatedAnswers}{' '}
                    {data.unevaluatedAnswers === 1
                        ? 'respuesta de esta sesión todavía no está evaluada'
                        : 'respuestas de esta sesión todavía no están evaluadas'}
                    : las evidencias de contenido y claridad aparecen recién cuando se evalúan en el
                    informe.
                </p>
            )}

            {closing && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[#fff6e5] p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#663820]">
                        <Quote className="size-4" aria-hidden="true" />
                        Lo que el jurado dijo al cerrar, en voz alta
                    </p>
                    <blockquote className="mt-2 text-sm leading-6 text-[#663820]">
                        {closing.spokenText}
                    </blockquote>
                    <p className="mt-2 text-xs text-[#8a7350]">
                        {dateTimeFormatter.format(new Date(closing.spokenAt))} ·{' '}
                        {closing.evidence.length}{' '}
                        {closing.evidence.length === 1 ? 'evidencia leída' : 'evidencias leídas'} ·
                        texto generado por código, no por el modelo · versión{' '}
                        <code>{closing.generatorVersion}</code>
                    </p>
                </div>
            )}
        </div>
    );
}
