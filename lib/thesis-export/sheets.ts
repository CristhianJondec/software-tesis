import type { SurveyAnswers } from '@/database/schema';
import { buildParticipantsTable, buildSessionsTable, buildTurnsTable, type MetricsTable } from '@/lib/metrics/exports';
import { RAGAS_METRIC_IDS, RAGAS_METRIC_LABELS } from '@/lib/metrics/ragas';
import type { MetricsInput, MetricsReport } from '@/lib/metrics/report';
import { normalizeStudyGroup } from '@/lib/study/groups';
import { effectiveVoiceLimitMinutes } from '@/lib/study/usage';
import { SURVEY_INSTRUMENTS, type SurveyPhase, type SurveyType } from '@/lib/surveys/catalog';
import { buildSurveyProgress, type SurveyProgressStage, type SurveyStageStatus } from '@/lib/surveys/progress';

/**
 * The "Exportar datos de tesis" workbook, as plain tables.
 *
 * Pure: the caller loads the rows and serialises the result to .xlsx. Every
 * score comes from what was stored at submission time (`computedScore`,
 * produced by lib/surveys/scoring.ts) and every metric from the same report
 * /metrics renders, so the file never disagrees with the app.
 *
 * Missing is empty, never 0: an O₂ that was not answered yet must not reach the
 * analysis as a measured zero.
 */

export type CellValue = string | number | Date | null | undefined;

export interface ExportSheet {
    name: string;
    headers: readonly string[];
    rows: CellValue[][];
}

export interface ExportUser {
    id: string;
    name: string;
    email: string;
    participantCode: string | null;
    studyGroup: string | null;
    createdAt: Date;
    voiceMinutesLimit: number | null;
}

export interface ExportResponse {
    userId: string;
    surveyType: string;
    phase: string;
    answers: SurveyAnswers;
    computedScore: number;
    submittedAt: Date;
}

export interface ExportUsage {
    userId: string;
    researchUploads: number;
    sessions: number;
    usedSeconds: number;
    firstSessionAt: Date | null;
    lastSessionAt: Date | null;
}

export interface ExportMaterial {
    title: string;
    description: string | null;
    fileName: string;
    fileSize: number;
    createdAt: Date;
}

export interface ThesisExportInput {
    users: ExportUser[];
    responses: ExportResponse[];
    usage: ExportUsage[];
    usersWithConversation: Set<string>;
    materials: ExportMaterial[];
    globalLimitMinutes: number | null;
    metricsInput: MetricsInput;
    report: MetricsReport;
}

const STATUS_LABELS: Record<SurveyStageStatus, string> = {
    completed: 'completada',
    available: 'pendiente',
    pending: 'bloqueada',
    not_applicable: 'no_aplica',
};

const MOMENTS: readonly { id: 'O1' | 'O2'; phase: SurveyPhase }[] = [
    { id: 'O1', phase: 'T1' },
    { id: 'O2', phase: 'T2' },
];

const STAI_ITEMS = SURVEY_INSTRUMENTS.STAI.questions.length;
const PRCS_ITEMS = SURVEY_INSTRUMENTS.PRCS12.questions.length;
const SUS_ITEMS = SURVEY_INSTRUMENTS.SUS.questions.length;

const itemHeaders = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}_item_${index + 1}`);

/** Raw answers in item order; undefined cells when the instrument was not answered. */
function rawItems(response: ExportResponse | undefined, count: number): CellValue[] {
    return Array.from({ length: count }, (_, index) => response?.answers[`item_${index + 1}`] ?? null);
}

const IDENTITY_HEADERS = ['usuario_id', 'codigo_participante', 'nombre', 'email', 'grupo'] as const;

function identity(user: ExportUser): CellValue[] {
    return [user.id, user.participantCode, user.name, user.email, normalizeStudyGroup(user.studyGroup)];
}

interface UserSurveys {
    find: (type: SurveyType, phase: SurveyPhase) => ExportResponse | undefined;
    stage: (type: SurveyType, phase: SurveyPhase) => SurveyProgressStage | undefined;
}

function surveysOf(user: ExportUser, input: ThesisExportInput, byUser: Map<string, ExportResponse[]>): UserSurveys {
    const responses = byUser.get(user.id) ?? [];
    const stages = buildSurveyProgress(user.studyGroup, responses, input.usersWithConversation.has(user.id));
    return {
        find: (type, phase) => responses.find((row) => row.surveyType === type && row.phase === phase),
        stage: (type, phase) => stages.find((stage) => stage.type === type && stage.phase === phase),
    };
}

function measurementsSheet(input: ThesisExportInput, byUser: Map<string, ExportResponse[]>): ExportSheet {
    const headers = [
        ...IDENTITY_HEADERS,
        'fecha_registro',
        'consentimiento',
        'momento',
        'estado_momento',
        'estado_stai',
        'fecha_stai',
        'estado_prcs12',
        'fecha_prcs12',
        'ae_stai_puntaje',
        'ac_prcs12_puntaje',
        ...itemHeaders('stai', STAI_ITEMS),
        ...itemHeaders('prcs12', PRCS_ITEMS),
    ];

    const rows = input.users.flatMap((user) => {
        const surveys = surveysOf(user, input, byUser);
        return MOMENTS.map(({ id, phase }) => {
            const stai = surveys.find('STAI', phase);
            const prcs = surveys.find('PRCS12', phase);
            const answered = Number(Boolean(stai)) + Number(Boolean(prcs));
            const stageStatus = (type: SurveyType) => {
                const stage = surveys.stage(type, phase);
                return stage ? STATUS_LABELS[stage.status] : null;
            };

            return [
                ...identity(user),
                user.createdAt,
                // The platform does not record consent; left empty on purpose.
                null,
                id,
                answered === 2 ? 'completo' : answered === 1 ? 'parcial' : 'sin_datos',
                stageStatus('STAI'),
                stai?.submittedAt,
                stageStatus('PRCS12'),
                prcs?.submittedAt,
                stai?.computedScore,
                prcs?.computedScore,
                ...rawItems(stai, STAI_ITEMS),
                ...rawItems(prcs, PRCS_ITEMS),
            ];
        });
    });

    return { name: 'mediciones_O1_O2', headers, rows };
}

function susSheet(input: ThesisExportInput, byUser: Map<string, ExportResponse[]>): ExportSheet {
    const headers = [...IDENTITY_HEADERS, 'estado_sus', 'fecha_sus', 'sus_puntaje', ...itemHeaders('sus', SUS_ITEMS)];
    const rows = input.users.map((user) => {
        const surveys = surveysOf(user, input, byUser);
        const sus = surveys.find('SUS', 'UNICA');
        const stage = surveys.stage('SUS', 'UNICA');
        return [
            ...identity(user),
            stage ? STATUS_LABELS[stage.status] : null,
            sus?.submittedAt,
            sus?.computedScore,
            ...rawItems(sus, SUS_ITEMS),
        ];
    });
    return { name: 'sus', headers, rows };
}

function usageSheet(input: ThesisExportInput): ExportSheet {
    const usageByUser = new Map(input.usage.map((row) => [row.userId, row]));
    const studentTurnsByUser = new Map<string, number>();
    for (const turn of input.metricsInput.turns) {
        if (turn.role !== 'user') continue;
        studentTurnsByUser.set(turn.userId, (studentTurnsByUser.get(turn.userId) ?? 0) + 1);
    }

    const headers = [
        ...IDENTITY_HEADERS,
        'investigaciones_subidas',
        'sesiones_voz',
        'turnos_estudiante',
        'minutos_voz_usados',
        'limite_personal_min',
        'limite_efectivo_min',
        'primera_sesion',
        'ultima_sesion',
        'materiales_publicados',
    ];
    const rows = input.users.map((user) => {
        const usage = usageByUser.get(user.id);
        return [
            ...identity(user),
            usage?.researchUploads ?? 0,
            usage?.sessions ?? 0,
            studentTurnsByUser.get(user.id) ?? 0,
            Math.round(((usage?.usedSeconds ?? 0) / 60) * 100) / 100,
            user.voiceMinutesLimit,
            effectiveVoiceLimitMinutes(user.voiceMinutesLimit, input.globalLimitMinutes),
            usage?.firstSessionAt,
            usage?.lastSessionAt,
            input.materials.length,
        ];
    });
    return { name: 'uso_intervencion', headers, rows };
}

function materialsSheet(input: ThesisExportInput): ExportSheet {
    return {
        name: 'materiales',
        headers: ['titulo', 'descripcion', 'archivo', 'tamano_kb', 'publicado'],
        rows: input.materials.map((material) => [
            material.title,
            material.description,
            material.fileName,
            Math.round(material.fileSize / 1024),
            material.createdAt,
        ]),
    };
}

function globalMetricsSheet(report: MetricsReport): ExportSheet {
    const { ica, observedIca, systemLatency, studentLatency, precision, ragas, ragasCoverage, corpus } = report;
    const rows: CellValue[][] = [
        ['ICA declarado (%)', ica.percentage, `Ci=${ica.integrated} / Ct=${ica.total}`],
        ['ICA observado, media por sesión (%)', observedIca.meanPercentage, `n=${observedIca.sessions} sesiones con turnos`],
        ['Sesiones con los 5 componentes (%)', observedIca.completePercentage, `${observedIca.completeSessions} sesiones`],
        ['LP — latencia del sistema, media (ms)', systemLatency.meanMs, `n=${systemLatency.n}`],
        ['Latencia del sistema, mediana (ms)', systemLatency.medianMs, null],
        ['Latencia del sistema, p95 (ms)', systemLatency.p95Ms, null],
        ['Latencia del estudiante, media (ms)', studentLatency.meanMs, `n=${studentLatency.n}`],
        ['Latencia del estudiante, mediana (ms)', studentLatency.medianMs, null],
        ['PR — precisión de respuestas (%)', precision.percentage, `Rc=${precision.correct} / Rt=${precision.reviewed}`],
        ['PR — turnos del agente sin revisar', precision.pending, `de ${precision.totalAgentTurns}`],
        ...RAGAS_METRIC_IDS.map((id): CellValue[] => [
            `RAGAs — ${RAGAS_METRIC_LABELS[id]}`,
            ragas[id].mean,
            `n=${ragas[id].n}`,
        ]),
        ['RAGAs — tripletas evaluadas', ragasCoverage.scored, `de ${ragasCoverage.triples}; versión ${report.ragasPromptVersion}`],
        ['Participantes con sesiones', corpus.participants, null],
        ['Sesiones', corpus.sessions, `${corpus.sessionsWithTurns} con turnos`],
        ['Turnos', corpus.turns, `${corpus.agentTurns} agente / ${corpus.studentTurns} estudiante`],
        ['Recuperaciones del retriever', corpus.retrievals, null],
        ['Generado', report.generatedAt, null],
    ];
    return { name: 'metricas_globales', headers: ['metrica', 'valor', 'detalle'], rows };
}

function fromMetricsTable(name: string, table: MetricsTable): ExportSheet {
    return { name, headers: table.headers, rows: table.rows.map((row) => row.map((cell) => (typeof cell === 'boolean' ? Number(cell) : cell))) };
}

const DICTIONARY: readonly (readonly [string, string, string])[] = [
    ['general', 'celdas vacías', 'Dato faltante o pendiente. Nunca equivale a 0. Las fechas están en UTC.'],
    ['general', 'usuario_id', 'Identificador interno estable de la cuenta. Sirve para unir todas las hojas.'],
    ['general', 'codigo_participante', 'Código asignado para desidentificar; vacío si no se asignó.'],
    ['general', 'nombre, email', 'Datos identificatorios de la cuenta. Eliminar antes del análisis.'],
    ['general', 'grupo', 'experimental | control | vacío (sin asignar, sin acceso).'],
    ['mediciones_O1_O2', 'fila', 'Una fila por estudiante y momento: O1 (pretest, fase T1) y O2 (postest, fase T2).'],
    ['mediciones_O1_O2', 'fecha_registro', 'Fecha de creación de la cuenta.'],
    ['mediciones_O1_O2', 'consentimiento', 'La plataforma no registra el consentimiento informado; la columna queda vacía para completarla con el registro externo.'],
    ['mediciones_O1_O2', 'estado_momento', 'completo = STAI y PRCS-12 respondidos; parcial = solo uno; sin_datos = ninguno.'],
    ['mediciones_O1_O2', 'estado_stai, estado_prcs12', 'completada | pendiente (habilitada, sin responder) | bloqueada (falta un requisito previo del flujo).'],
    ['mediciones_O1_O2', 'fecha_stai, fecha_prcs12', 'Momento de envío del instrumento.'],
    ['mediciones_O1_O2', 'ae_stai_puntaje', 'AE — STAI-Estado. Suma de 20 ítems (0–3) con los ítems 1, 2, 5, 8, 10, 11, 15, 16, 19 y 20 invertidos (3 − x). Rango 0–60. Mayor = más ansiedad estado.'],
    ['mediciones_O1_O2', 'ac_prcs12_puntaje', 'AC — PRCS-12. Suma de 12 ítems (1–6) con los ítems 1, 6, 8, 10, 11 y 12 invertidos (7 − x). Rango 12–72. Mayor = más ansiedad al hablar en público.'],
    ['mediciones_O1_O2', 'stai_item_1 … stai_item_20', 'Respuesta cruda, sin invertir: 0 Nada, 1 Algo, 2 Bastante, 3 Mucho.'],
    ['mediciones_O1_O2', 'prcs12_item_1 … prcs12_item_12', 'Respuesta cruda, sin invertir: 1 = completamente de acuerdo … 6 = completamente en desacuerdo.'],
    ['mediciones_O1_O2', 'Δ (O2 − O1)', 'No se exporta calculado: un valor negativo indica reducción de ansiedad en AE y en AC.'],
    ['sus', 'estado_sus', 'completada | pendiente | bloqueada | no_aplica (el grupo control no responde SUS).'],
    ['sus', 'sus_puntaje', 'SUS. Ítems impares (x − 1), pares (5 − x), suma × 2,5. Rango 0–100. Mayor = mejor usabilidad.'],
    ['sus', 'sus_item_1 … sus_item_10', 'Respuesta cruda: 1 = totalmente en desacuerdo … 5 = totalmente de acuerdo.'],
    ['uso_intervencion', 'investigaciones_subidas', 'PDFs de investigación subidos por el estudiante.'],
    ['uso_intervencion', 'sesiones_voz, turnos_estudiante', 'Sesiones con el agente de voz iniciadas y turnos hablados por el estudiante.'],
    ['uso_intervencion', 'minutos_voz_usados', 'Suma de la duración de todas las sesiones de voz, en minutos.'],
    ['uso_intervencion', 'limite_personal_min, limite_efectivo_min', 'Tope de minutos personal y el que aplica (personal o general). Vacío = sin límite.'],
    ['uso_intervencion', 'materiales_publicados', 'Documentos disponibles en Materiales. La plataforma no registra qué participante los abrió.'],
    ['materiales', 'fila', 'Un documento compartido del grupo control.'],
    ['sesiones', 'fila', 'Una sesión de voz. Mismas columnas que metricas-sesiones.csv de /metrics.'],
    ['sesiones', 'autoeval_previa, autoeval_posterior', 'Autoevaluación de ansiedad 0–10 antes y después de la sesión. Mayor = más ansiedad.'],
    ['sesiones', 'nivel_exigencia, origen_nivel', 'Nivel 1–4 de exposición gradual; auto = sugerido y aceptado, manual = elegido por el estudiante.'],
    ['sesiones', 'ica_observado', '(Ci / Ct) × 100 con los componentes observados en la sesión. Mayor = arquitectura más completa.'],
    ['sesiones', 'lat_sistema_*', 'Fin del turno del estudiante → inicio de la respuesta del agente (ms). Menor = mejor.'],
    ['sesiones', 'lat_estudiante_*', 'Fin de la pregunta del agente → primera palabra del estudiante (ms).'],
    ['sesiones', 'pr_*', 'Precisión de respuestas: revisados (Rt), correctos (Rc) y (Rc / Rt) × 100. Mayor = mejor.'],
    ['sesiones', 'ragas_*', 'Medias RAGAs 0–1 sobre las tripletas evaluadas. Mayor = respuesta más anclada al documento.'],
    ['sesiones', 'fb_*', 'Informe post-sesión: nivel medio de rúbrica de contenido y claridad, n y no concluyentes.'],
    ['metricas_participantes', 'fila', 'Agregado por participante de las métricas de sesión. lat_estudiante_delta_ms = última − primera sesión.'],
    ['turnos', 'fila', 'Un turno de conversación (agente o estudiante) con latencias, veredicto humano, RAGAs y texto.'],
    ['turnos', 'correcto', '1 / 0 si fue revisado; vacío si sigue pendiente (no equivale a incorrecto).'],
    ['metricas_globales', 'fila', 'Indicadores del corpus completo: ICA, LP, latencia del estudiante, PR y RAGAs, con su n.'],
];

export function buildThesisSheets(input: ThesisExportInput): ExportSheet[] {
    const byUser = new Map<string, ExportResponse[]>();
    for (const response of input.responses) {
        const list = byUser.get(response.userId) ?? [];
        list.push(response);
        byUser.set(response.userId, list);
    }

    return [
        measurementsSheet(input, byUser),
        susSheet(input, byUser),
        usageSheet(input),
        materialsSheet(input),
        fromMetricsTable('sesiones', buildSessionsTable(input.report)),
        fromMetricsTable('metricas_participantes', buildParticipantsTable(input.report)),
        fromMetricsTable('turnos', buildTurnsTable(input.metricsInput, input.report)),
        globalMetricsSheet(input.report),
        { name: 'diccionario', headers: ['hoja', 'columna', 'descripcion'], rows: DICTIONARY.map((row) => [...row]) },
    ];
}
