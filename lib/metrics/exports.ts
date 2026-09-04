import { isoOrEmpty, toCsv, type CsvValue } from './csv';
import type { MetricsInput, MetricsReport } from './report';

/**
 * The three CSV files the results chapter needs.
 *
 * One file per unit of analysis, because mixing units in a single sheet is what
 * makes an export unusable in SPSS: `turnos` is the raw measurement level,
 * `sesiones` and `participantes` are the aggregates the thesis actually reports.
 * Every file carries `codigo_participante` so it can be joined against the
 * surveys applied outside the app.
 *
 * Headers are in Spanish: they are read by the researcher, not by the code.
 */

export interface CsvFile {
    filename: string;
    content: string;
}

const SESSION_HEADERS = [
    'codigo_participante',
    'grupo_estudio',
    'usuario_id',
    'sesion_id',
    'numero_sesion',
    'investigacion',
    'inicio',
    'fin',
    'duracion_segundos',
    'turnos',
    'turnos_agente',
    'turnos_estudiante',
    'lat_sistema_n',
    'lat_sistema_media_ms',
    'lat_sistema_mediana_ms',
    'lat_sistema_min_ms',
    'lat_sistema_max_ms',
    'lat_estudiante_n',
    'lat_estudiante_media_ms',
    'lat_estudiante_mediana_ms',
    'lat_estudiante_min_ms',
    'lat_estudiante_max_ms',
    'pr_revisados',
    'pr_correctos',
    'pr_porcentaje',
    'ragas_faithfulness',
    'ragas_answer_relevancy',
    'ragas_context_precision',
    'ragas_context_recall',
    'ragas_n',
];

export function buildSessionsCsv(report: MetricsReport): CsvFile {
    const rows: CsvValue[][] = report.sessions.map((session) => [
        session.participantCode,
        session.studyGroup,
        session.userId,
        session.sessionId,
        session.sessionNumber,
        session.bookTitle,
        isoOrEmpty(session.startedAt),
        isoOrEmpty(session.endedAt),
        session.durationSeconds,
        session.turns,
        session.agentTurns,
        session.studentTurns,
        session.systemLatency.n,
        session.systemLatency.meanMs,
        session.systemLatency.medianMs,
        session.systemLatency.minMs,
        session.systemLatency.maxMs,
        session.studentLatency.n,
        session.studentLatency.meanMs,
        session.studentLatency.medianMs,
        session.studentLatency.minMs,
        session.studentLatency.maxMs,
        session.precision.reviewed,
        session.precision.correct,
        session.precision.percentage,
        session.ragas.faithfulness.mean,
        session.ragas.answerRelevancy.mean,
        session.ragas.contextPrecision.mean,
        session.ragas.contextRecall.mean,
        session.ragas.faithfulness.n,
    ]);

    return { filename: 'metricas-sesiones.csv', content: toCsv(SESSION_HEADERS, rows) };
}

const PARTICIPANT_HEADERS = [
    'codigo_participante',
    'grupo_estudio',
    'usuario_id',
    'sesiones',
    'turnos',
    'turnos_agente',
    'turnos_estudiante',
    'duracion_total_segundos',
    'lat_sistema_n',
    'lat_sistema_media_ms',
    'lat_sistema_mediana_ms',
    'lat_estudiante_n',
    'lat_estudiante_media_ms',
    'lat_estudiante_mediana_ms',
    'lat_estudiante_primera_sesion_ms',
    'lat_estudiante_ultima_sesion_ms',
    'lat_estudiante_delta_ms',
    'pr_revisados',
    'pr_correctos',
    'pr_porcentaje',
];

export function buildParticipantsCsv(report: MetricsReport): CsvFile {
    const rows: CsvValue[][] = report.participants.map((participant) => [
        participant.participantCode,
        participant.studyGroup,
        participant.userId,
        participant.sessions,
        participant.turns,
        participant.agentTurns,
        participant.studentTurns,
        participant.totalDurationSeconds,
        participant.systemLatency.n,
        participant.systemLatency.meanMs,
        participant.systemLatency.medianMs,
        participant.studentLatency.n,
        participant.studentLatency.meanMs,
        participant.studentLatency.medianMs,
        participant.firstSessionStudentMeanMs,
        participant.lastSessionStudentMeanMs,
        participant.studentDeltaMs,
        participant.precision.reviewed,
        participant.precision.correct,
        participant.precision.percentage,
    ]);

    return { filename: 'metricas-participantes.csv', content: toCsv(PARTICIPANT_HEADERS, rows) };
}

const TURN_HEADERS = [
    'codigo_participante',
    'grupo_estudio',
    'usuario_id',
    'sesion_id',
    'numero_sesion',
    'turno_id',
    'indice_turno',
    'rol',
    'inicio',
    'fin',
    'duracion_turno_ms',
    'lat_estudiante_ms',
    'lat_sistema_ms',
    'fragmentos_recuperados',
    'evaluado',
    'correcto',
    'notas',
    'ragas_faithfulness',
    'ragas_answer_relevancy',
    'ragas_context_precision',
    'ragas_context_recall',
    'contenido',
];

/**
 * Raw measurement level: one row per conversation turn, with its latencies, its
 * human verdict and its RAGAs scores when it has them. This is the file a
 * statistical test actually runs on.
 */
export function buildTurnsCsv(input: MetricsInput, report: MetricsReport): CsvFile {
    const sessionNumbers = new Map(report.sessions.map((s) => [s.sessionId, s.sessionNumber]));
    const evaluationByTurn = new Map(input.evaluations.map((e) => [e.turnId, e]));
    const ragasByTurn = new Map(input.ragasRows.map((r) => [r.turnId, r]));

    const retrievalCounts = new Map<string, number>();
    for (const retrieval of input.retrievals) {
        if (!retrieval.turnId) continue;
        retrievalCounts.set(retrieval.turnId, (retrievalCounts.get(retrieval.turnId) ?? 0) + 1);
    }

    const rows: CsvValue[][] = input.turns.map((turn) => {
        const evaluation = evaluationByTurn.get(turn.turnId);
        const ragas = ragasByTurn.get(turn.turnId);

        return [
            turn.participantCode,
            turn.studyGroup,
            turn.userId,
            turn.sessionId,
            sessionNumbers.get(turn.sessionId) ?? null,
            turn.turnId,
            turn.turnIndex,
            turn.role,
            isoOrEmpty(turn.startedAt),
            isoOrEmpty(turn.endedAt),
            turn.endedAt.getTime() - turn.startedAt.getTime(),
            turn.studentLatencyMs,
            turn.systemLatencyMs,
            retrievalCounts.get(turn.turnId) ?? 0,
            evaluation ? 1 : 0,
            // Empty, not 0, when nobody has reviewed it: an unreviewed turn is
            // not an incorrect turn.
            evaluation ? (evaluation.isCorrect ? 1 : 0) : null,
            evaluation?.notes ?? null,
            ragas?.faithfulness ?? null,
            ragas?.answerRelevancy ?? null,
            ragas?.contextPrecision ?? null,
            ragas?.contextRecall ?? null,
            turn.content,
        ];
    });

    return { filename: 'metricas-turnos.csv', content: toCsv(TURN_HEADERS, rows) };
}

export function buildAllCsvFiles(input: MetricsInput, report: MetricsReport): CsvFile[] {
    return [buildSessionsCsv(report), buildParticipantsCsv(report), buildTurnsCsv(input, report)];
}
