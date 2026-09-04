/**
 * Fixed question battery for the pilot measurements.
 *
 * Why it exists: PR and RAGAs are only comparable between sprints if the system
 * is asked the same things. Free conversation is what the study measures, but a
 * moving question set turns every re-measurement into a different experiment.
 * Run this battery verbatim before and after each change to the prompt, the
 * segmentation or the retriever, and the deltas mean something.
 *
 * The questions are structural on purpose — they work against any research draft,
 * so the battery does not have to be rewritten per participant.
 *
 * The `fuera-de-tema` block doubles as the off-topic control that doc 03 needs
 * to calibrate RETRIEVER_MAX_DISTANCE: run it, read the `distance` column of
 * `turn_retrievals`, and compare against the on-topic distances.
 *
 * Pure data module: no imports, no side effects.
 */

export type PilotCategory = 'estructura' | 'metodologia' | 'profundidad' | 'fuera-de-tema';

export interface PilotQuestion {
    id: string;
    category: PilotCategory;
    text: string;
    /** What a correct agent answer looks like, for the human rater of PR. */
    expectation: string;
}

export const PILOT_QUESTIONS: readonly PilotQuestion[] = [
    {
        id: 'est-01',
        category: 'estructura',
        text: '¿Cuál es el problema que aborda su investigación?',
        expectation: 'Reformula el problema tal como aparece en el documento, sin agregar un problema que la investigación no plantea.',
    },
    {
        id: 'est-02',
        category: 'estructura',
        text: '¿Cuáles son sus objetivos específicos?',
        expectation: 'Enumera los objetivos que están en el documento y no inventa objetivos adicionales.',
    },
    {
        id: 'est-03',
        category: 'estructura',
        text: '¿Qué antecedentes sustentan su trabajo?',
        expectation: 'Cita antecedentes presentes en el marco teórico del documento.',
    },
    {
        id: 'met-01',
        category: 'metodologia',
        text: '¿Qué tipo y diseño de investigación eligió, y por qué?',
        expectation: 'Recupera el tipo y diseño declarados; si el documento no justifica la elección, lo señala en vez de justificarla por su cuenta.',
    },
    {
        id: 'met-02',
        category: 'metodologia',
        text: '¿Cómo determinó su población y su muestra?',
        expectation: 'Reporta población, muestra y criterio de selección tal como figuran en el documento.',
    },
    {
        id: 'met-03',
        category: 'metodologia',
        text: '¿Qué instrumentos usó y cómo validó su confiabilidad?',
        expectation: 'Nombra los instrumentos del documento; si no hay evidencia de validación, lo declara como vacío.',
    },
    {
        id: 'pro-01',
        category: 'profundidad',
        text: 'Usted afirma una relación entre sus variables. ¿Qué evidencia de su propio documento la respalda?',
        expectation: 'Ancla la repregunta en un fragmento concreto del documento y exige evidencia, sin aportar evidencia externa.',
    },
    {
        id: 'pro-02',
        category: 'profundidad',
        text: '¿Qué limitaciones reconoce en su avance?',
        expectation: 'Recupera las limitaciones declaradas; si el documento no las declara, lo dice explícitamente.',
    },
    {
        id: 'pro-03',
        category: 'profundidad',
        text: '¿Cómo definiría operacionalmente su variable dependiente?',
        expectation: 'Recupera la operacionalización del documento, incluidas dimensiones e indicadores si existen.',
    },
    {
        id: 'fue-01',
        category: 'fuera-de-tema',
        text: '¿Qué opina el documento sobre la regulación de las criptomonedas en el Perú?',
        expectation: 'Declara que el tema no aparece en la investigación. No debe recuperar fragmentos ni citar páginas.',
    },
    {
        id: 'fue-02',
        category: 'fuera-de-tema',
        text: '¿Qué dice su investigación sobre el mantenimiento de motores diésel?',
        expectation: 'Declara que el tema no aparece en la investigación.',
    },
    {
        id: 'fue-03',
        category: 'fuera-de-tema',
        text: '¿Cuál es la receta del ceviche que recomienda el autor?',
        expectation: 'Declara que el tema no aparece en la investigación y no sigue el juego.',
    },
];

export const PILOT_QUESTIONS_BY_CATEGORY: Record<PilotCategory, PilotQuestion[]> = {
    estructura: PILOT_QUESTIONS.filter((q) => q.category === 'estructura'),
    metodologia: PILOT_QUESTIONS.filter((q) => q.category === 'metodologia'),
    profundidad: PILOT_QUESTIONS.filter((q) => q.category === 'profundidad'),
    'fuera-de-tema': PILOT_QUESTIONS.filter((q) => q.category === 'fuera-de-tema'),
};
