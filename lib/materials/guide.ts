import { PREPARATION_TOPIC_IDS, PREPARATION_TOPICS, type PreparationTopicId } from '@/lib/preparation/topics';

/**
 * Static preparation dossier for the control arm.
 *
 * It is deliberately keyed to `PREPARATION_TOPICS` — the SAME twelve sections
 * the agent examines the experimental arm on. That makes this a content-matched
 * control: both arms get the same subject matter, and the only difference
 * between them is the delivery (reading a dossier vs. defending it aloud
 * against an agent that reads your own document). Without that matching, a
 * difference between arms could be explained by "the experimental group simply
 * received more information", which is not the hypothesis under test.
 *
 * All student-facing strings are in Spanish.
 */

export interface GuideSection {
    id: string;
    title: string;
    summary: string;
    items: readonly string[];
}

/** Typical jury questions per topic, written the way a jury actually asks them. */
const JURY_QUESTIONS: Record<PreparationTopicId, readonly string[]> = {
    problema: [
        '¿Cuál es exactamente el problema que investiga y dónde ocurre?',
        '¿Qué evidencia tiene de que ese problema existe y no es una suposición suya?',
        '¿Por qué delimitó el problema a ese contexto y no a otro?',
    ],
    objetivos: [
        '¿Su objetivo general responde realmente al problema que planteó?',
        '¿Cómo sabrá que cumplió cada objetivo específico?',
        'Si tiene hipótesis: ¿qué resultado la confirmaría y cuál la refutaría?',
    ],
    justificacion: [
        '¿A quién le sirve este estudio en concreto?',
        '¿Qué aporta su trabajo que no exista ya en la literatura?',
        '¿Qué pasaría si este estudio no se hiciera?',
    ],
    antecedentes: [
        '¿Qué antecedente sostiene la decisión metodológica que tomó?',
        '¿En qué se diferencia su estudio del antecedente más parecido?',
        '¿Por qué eligió esos antecedentes y descartó otros?',
    ],
    'marco-teorico': [
        '¿Qué teoría sustenta su variable principal y por qué esa y no otra?',
        '¿Cómo define operacionalmente cada variable?',
        '¿Qué autor respalda esa definición?',
    ],
    metodologia: [
        '¿Hay coherencia entre su problema, sus objetivos y el diseño que eligió?',
        '¿Por qué ese enfoque y ese diseño, y no uno alternativo?',
        '¿Qué análisis aplicará a los datos y por qué es el adecuado?',
    ],
    muestra: [
        '¿Cómo calculó el tamaño de la muestra?',
        '¿Qué técnica de muestreo usó y qué sesgos introduce?',
        '¿Sus criterios de inclusión y exclusión están escritos en el documento?',
    ],
    instrumentos: [
        '¿Cómo validó el instrumento?',
        '¿Qué evidencia de confiabilidad tiene y cuál fue el coeficiente?',
        'Si adaptó un instrumento existente: ¿qué modificó y con qué justificación?',
    ],
    resultados: [
        '¿Qué dice exactamente esa tabla o ese gráfico?',
        '¿Cómo obtuvo ese valor?',
        'Si aún no tiene resultados: ¿qué espera encontrar y por qué?',
    ],
    discusion: [
        '¿Con qué antecedente contrasta sus resultados?',
        'Si su resultado difiere del de ese autor, ¿cómo lo explica?',
        '¿Qué parte de su discusión es interpretación suya y qué parte es hallazgo?',
    ],
    conclusiones: [
        '¿Cada conclusión se desprende de un resultado concreto?',
        '¿Cada objetivo tiene su conclusión correspondiente?',
        '¿Sus recomendaciones se siguen de lo que encontró o son opiniones generales?',
    ],
    limitaciones: [
        '¿Qué limitaciones reconoce su estudio?',
        '¿Cómo afectan esas limitaciones al alcance de sus conclusiones?',
        '¿Qué no puede afirmar con los datos que tiene?',
    ],
};

/** The twelve examined sections, with what the jury presses on in each one. */
export const TOPIC_GUIDE = PREPARATION_TOPIC_IDS.map((id) => {
    const topic = PREPARATION_TOPICS[id];
    return {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        focusHint: topic.focusHint,
        questions: JURY_QUESTIONS[id],
    };
});

export const GUIDE_INTRO =
    'Este material reúne lo que un jurado evalúa en la sustentación de un avance de investigación. ' +
    'Léelo con tu propio documento al lado: la recomendación no es memorizarlo, sino responder cada ' +
    'pregunta señalando la página de tu investigación donde está la respuesta. Si una pregunta no ' +
    'tiene respuesta en tu documento, eso es un vacío que conviene cerrar antes de la sustentación.';

export const GUIDE_SECTIONS: readonly GuideSection[] = [
    {
        id: 'estructura',
        title: 'Estructura de la exposición',
        summary: 'Un avance se sustenta en 15–20 minutos. Este es un reparto de tiempo que funciona.',
        items: [
            'Presentación y título (1 min): quién eres, qué investigas y en una sola frase por qué importa.',
            'Problema y justificación (3 min): el problema, la evidencia de que existe y a quién le sirve resolverlo.',
            'Objetivos e hipótesis (2 min): el objetivo general primero; los específicos como pasos para alcanzarlo.',
            'Marco teórico y antecedentes (3 min): solo las teorías y los estudios que sostienen tus decisiones, no un resumen de todo lo leído.',
            'Metodología (4 min): enfoque, diseño, población, muestra e instrumentos. Es donde más se pregunta.',
            'Avance de resultados (3 min): lo que ya tienes. Si aún no hay datos, qué esperas encontrar y con qué análisis.',
            'Conclusiones parciales y siguientes pasos (2 min): cierra diciendo qué falta y en qué plazo.',
        ],
    },
    {
        id: 'tecnica',
        title: 'Técnica de exposición oral',
        summary: 'La forma de responder pesa tanto como el contenido en la calificación.',
        items: [
            'Habla a un ritmo que te permita respirar. Ir rápido se lee como nerviosismo, no como dominio.',
            'Antes de responder, toma dos segundos. Un silencio breve antes de una respuesta firme vale más que una respuesta inmediata y desordenada.',
            'Responde primero la pregunta en una frase, y recién después desarrolla. El jurado necesita oír la respuesta, no el camino hacia ella.',
            'Sostén la mirada en quien pregunta mientras respondes.',
            'Evita muletillas de relleno ("este…", "o sea", "digamos"). Sustitúyelas por una pausa.',
            'No leas las diapositivas. Deben tener pocas palabras y servirte de guion, no de texto.',
        ],
    },
    {
        id: 'no-se',
        title: 'Cuando no sabes la respuesta',
        summary: 'El jurado no espera omnisciencia; espera honestidad metodológica. Esto es lo que sí se puede decir.',
        items: [
            'Reconoce el límite con precisión: "ese dato no lo tengo calculado todavía; lo tendré con la muestra completa".',
            'Ofrece lo que sí sabes: "no tengo el coeficiente exacto, pero el instrumento fue validado por juicio de tres expertos".',
            'Si no entendiste la pregunta, pide que la reformulen. Es preferible a responder otra cosa.',
            'Nunca inventes una cifra, un autor o una referencia. Una cifra inventada que el jurado detecta desmonta toda la sustentación.',
            'Si el jurado señala un error real, acéptalo y di cómo lo vas a corregir. Defender un error indefendible cuesta más que el error.',
        ],
    },
    {
        id: 'errores',
        title: 'Errores frecuentes que penaliza el jurado',
        summary: 'Los más repetidos en sustentaciones de avance.',
        items: [
            'Objetivos que no se corresponden con el problema planteado.',
            'Conclusiones que no se desprenden de ningún resultado.',
            'Antecedentes citados que no se usan después en la discusión.',
            'Muestra sin justificación de su tamaño ni de la técnica de selección.',
            'Instrumento sin evidencia de validez ni de confiabilidad.',
            'Confundir resultado (lo que arrojan los datos) con interpretación (lo que tú sostienes a partir de ellos).',
            'No reconocer ninguna limitación. Un estudio sin limitaciones declaradas parece un estudio no examinado.',
        ],
    },
    {
        id: 'checklist',
        title: 'Verificación antes de la sustentación',
        summary: 'Recórrela con tu documento abierto.',
        items: [
            'Puedo enunciar mi objetivo general de memoria y en una sola frase.',
            'Sé en qué página de mi documento está cada una de las doce secciones que el jurado examina.',
            'Cada objetivo específico tiene un resultado o un plan de análisis que le corresponde.',
            'Puedo justificar el tamaño de mi muestra con un criterio explícito.',
            'Puedo nombrar la validez y la confiabilidad de mi instrumento con cifras.',
            'Tengo identificado el antecedente más cercano a mi estudio y sé en qué me diferencio de él.',
            'Tengo escritas mis limitaciones y sé cómo afectan a mis conclusiones.',
            'Ensayé la exposición completa en voz alta, cronometrada, al menos una vez.',
        ],
    },
];
