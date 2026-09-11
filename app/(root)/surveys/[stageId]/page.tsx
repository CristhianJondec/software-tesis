import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';

import SurveyForm from '@/components/surveys/SurveyForm';
import { Button } from '@/components/ui/button';
import { getSurveyProgress } from '@/lib/actions/survey.actions';
import { findSurveyStage, SURVEY_INSTRUMENTS } from '@/lib/surveys/catalog';

export const dynamic = 'force-dynamic';

export default async function SurveyStagePage({ params }: { params: Promise<{ stageId: string }> }) {
    const { stageId } = await params;
    const stage = findSurveyStage(stageId);
    const progressResult = await getSurveyProgress();
    const progressStage = progressResult.data?.stages.find((item) => item.id === stageId);

    if (!stage || !progressResult.success || !progressStage) {
        return (
            <main className="wrapper container">
                <h1 className="page-title-xl">Encuesta no disponible</h1>
                <p className="subtitle mt-4">{progressResult.error ?? 'La etapa solicitada no existe.'}</p>
                <Button asChild variant="outline" className="mt-6"><Link href="/surveys">Volver a encuestas</Link></Button>
            </main>
        );
    }

    if (progressStage.status !== 'available') {
        const reason = progressStage.status === 'completed'
            ? 'Esta etapa ya fue enviada y no admite modificaciones.'
            : progressStage.status === 'not_applicable'
                ? 'Esta etapa no corresponde a tu grupo de estudio.'
                : 'Completa primero la etapa anterior para desbloquear esta encuesta.';
        return (
            <main className="wrapper container">
                <div className="max-w-2xl rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
                    <LockKeyhole className="mb-4 size-9 text-[#663820]" />
                    <h1 className="font-serif text-3xl font-bold">Etapa no disponible</h1>
                    <p className="subtitle mt-3">{reason}</p>
                    <Button asChild variant="outline" className="mt-6"><Link href="/surveys">Volver a encuestas</Link></Button>
                </div>
            </main>
        );
    }

    const instrument = SURVEY_INSTRUMENTS[stage.type];
    return (
        <main className="wrapper container">
            <Button asChild variant="ghost" className="mb-5 -ml-3">
                <Link href="/surveys"><ArrowLeft className="size-4" /> Volver a las etapas</Link>
            </Button>
            <header className="mb-8 max-w-4xl">
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#663820]">Cuestionario</p>
                <h1 className="page-title-xl">{stage.title}</h1>
                <p className="mt-5 rounded-xl border-l-4 border-[#d4a853] bg-white p-5 leading-7 text-[var(--text-secondary)] shadow-sm">
                    {instrument.instructions}
                </p>
            </header>
            <SurveyForm stageId={stage.id} instrument={instrument} />
        </main>
    );
}
