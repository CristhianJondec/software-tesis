export type SurveyType = 'STAI' | 'PRCS12' | 'SUS';
export type SurveyPhase = 'T1' | 'T2' | 'UNICA';
export type SurveyStageId = 'stai-t1' | 'prcs12-t1' | 'sus' | 'stai-t2' | 'prcs12-t2';

export interface SurveyInstrument {
    type: SurveyType;
    scoreLabel: 'AE' | 'AC' | 'SUS';
    instructions: string;
    questions: readonly string[];
    options: readonly { value: number; label: string }[];
}

export interface SurveyStage {
    id: SurveyStageId;
    type: SurveyType;
    phase: SurveyPhase;
    title: string;
    shortTitle: string;
}

export const SURVEY_INSTRUMENTS: Record<SurveyType, SurveyInstrument> = {
    STAI: {
        type: 'STAI',
        scoreLabel: 'AE',
        instructions: 'A continuación encontrará unas frases que se utilizan corrientemente para describirse uno a sí mismo. Lea cada frase y señale la puntuación de 0 a 3 que indique mejor cómo se siente usted ahora mismo, en este momento. No hay respuestas buenas ni malas. No emplee demasiado tiempo en cada frase y conteste señalando la respuesta que mejor describa su situación presente.',
        options: [
            { value: 0, label: 'Nada' },
            { value: 1, label: 'Algo' },
            { value: 2, label: 'Bastante' },
            { value: 3, label: 'Mucho' },
        ],
        questions: [
            'Me siento calmado',
            'Me siento seguro',
            'Estoy tenso',
            'Estoy contrariado',
            'Me siento cómodo (estoy a gusto)',
            'Me siento alterado',
            'Estoy preocupado ahora por posibles desgracias futuras',
            'Me siento descansado',
            'Me siento angustiado',
            'Me siento confortable',
            'Tengo confianza en mí mismo',
            'Me siento nervioso',
            'Estoy desasosegado',
            'Me siento muy «atado» (como oprimido)',
            'Estoy relajado',
            'Me siento satisfecho',
            'Estoy preocupado',
            'Me siento aturdido y sobreexcitado',
            'Me siento alegre',
            'En este momento me siento bien',
        ],
    },
    PRCS12: {
        type: 'PRCS12',
        scoreLabel: 'AC',
        instructions: 'A continuación se presentan una serie de afirmaciones sobre cómo se siente al hablar en público. Lea atentamente cada una y marque, en una escala del 1 al 6, el grado en que está de acuerdo con cada enunciado, donde 1 = completamente de acuerdo y 6 = completamente en desacuerdo. No hay respuestas correctas ni incorrectas; responda con sinceridad.',
        options: [
            { value: 1, label: 'Completamente de acuerdo' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 5, label: '5' },
            { value: 6, label: 'Completamente en desacuerdo' },
        ],
        questions: [
            'Cuando hablo ante un grupo, me pongo tan nervioso(a) que olvido los hechos que realmente conozco bien',
            'No tengo miedo de estar enfrente del auditorio',
            'Aunque estoy nervioso(a) justo antes de ponerme de pie, pronto olvido mis temores y disfruto de la experiencia',
            'Afronto con completa confianza la perspectiva de dar una charla',
            'Creo que estoy en completa posesión de mí mismo(a) mientras hablo',
            'Aunque hablo con fluidez con mis amigos, no encuentro palabras para expresarme en la tarima',
            'Me siento relajado(a) y a gusto mientras hablo',
            'Siempre que me es posible, evito hablar en público',
            'Mi mente está clara cuando me encuentro delante de un auditorio',
            'Mi postura parece forzada y poco natural',
            'Tengo miedo y estoy tenso(a) todo el tiempo que estoy hablando delante de un grupo de gente',
            'Me siento aterrorizado(a) ante la idea de hablar delante de un grupo de personas',
        ],
    },
    SUS: {
        type: 'SUS',
        scoreLabel: 'SUS',
        instructions: 'A continuación encontrará una serie de afirmaciones relacionadas con su experiencia al usar el agente conversacional. Para cada una, indique su grado de acuerdo marcando un valor de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo). No hay respuestas correctas ni incorrectas; responda según su percepción real.',
        options: [
            { value: 1, label: 'Totalmente en desacuerdo' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
            { value: 4, label: '4' },
            { value: 5, label: 'Totalmente de acuerdo' },
        ],
        questions: [
            'Creo que me gustaría usar este sistema frecuentemente.',
            'Encontré el sistema innecesariamente complejo.',
            'Pensé que el sistema era fácil de usar.',
            'Creo que necesitaría la ayuda de una persona con conocimientos técnicos para poder usar este sistema.',
            'Encontré que las diversas funciones de este sistema estaban bien integradas.',
            'Pensé que había demasiada inconsistencia en este sistema.',
            'Imagino que la mayoría de las personas aprenderían a usar este sistema muy rápidamente.',
            'Encontré el sistema muy difícil de usar.',
            'Me sentí muy seguro(a) usando el sistema.',
            'Necesité aprender muchas cosas antes de poder empezar a usar este sistema.',
        ],
    },
};

export const SURVEY_STAGES: readonly SurveyStage[] = [
    { id: 'stai-t1', type: 'STAI', phase: 'T1', title: 'STAI — Medición Basal (T1)', shortTitle: 'STAI T1' },
    { id: 'prcs12-t1', type: 'PRCS12', phase: 'T1', title: 'PRCS-12 — Medición Basal (T1)', shortTitle: 'PRCS-12 T1' },
    { id: 'sus', type: 'SUS', phase: 'UNICA', title: 'SUS — Usabilidad del agente', shortTitle: 'SUS' },
    { id: 'stai-t2', type: 'STAI', phase: 'T2', title: 'STAI — Medición Posterior (T2)', shortTitle: 'STAI T2' },
    { id: 'prcs12-t2', type: 'PRCS12', phase: 'T2', title: 'PRCS-12 — Medición Posterior (T2)', shortTitle: 'PRCS-12 T2' },
];

export function findSurveyStage(stageId: string): SurveyStage | undefined {
    return SURVEY_STAGES.find((stage) => stage.id === stageId);
}

export function responseKey(type: SurveyType, phase: SurveyPhase): string {
    return `${type}:${phase}`;
}

export function isStageApplicable(stage: SurveyStage, studyGroup: string | null): boolean {
    return !(stage.type === 'SUS' && studyGroup?.toLowerCase() === 'control');
}
