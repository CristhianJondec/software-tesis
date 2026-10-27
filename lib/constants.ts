// Brand color - used in JS files where CSS variables aren't available
export const BRAND_COLOR = '#212a3b'; // Dark blue-gray
export const BRAND_COLOR_HOVER = '#3d485e'; // Medium blue-gray

// File validation helpers
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_PDF_TYPES = ['application/pdf'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Operational cap for a single live call. It is not tied to a payment plan.
export const MAX_SESSION_DURATION_MINUTES = 20;

// Minutes before the cap at which the agent is told to move to the closing,
// so the session ends with its observations instead of being cut mid-question.
export const SESSION_WRAP_UP_MINUTES_BEFORE_END = 3;

// Vapi's own call cap (maxDurationSeconds) is sent from code with this margin
// over the app cap: the app hangs up first with its own message, and Vapi only
// acts as a backstop. Without it, the dashboard value (10 min by default) rules.
export const VAPI_MAX_DURATION_BUFFER_SECONDS = 30;

// The cap on thesis uploads per account lives in lib/study/uploads.ts (set by
// the admin from /admin). Independent of the legacy subscription/billing
// scaffolding — do not read PLAN_LIMITS.maxBooks for this.

// Pre-configured VAPI assistant ID (hardcoded for this app)
export const ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID!;

// LLM of the evaluating professor. Sent from code on every call alongside the
// system prompt (lib/agent-prompt.ts), so the dashboard no longer decides the
// agent's behaviour. These values are reported in the thesis; the rationale for
// each one is in docs/agente/vapi-config.md.
export const EVALUATOR_MODEL = {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.4,
    // Room for the closing and longer explanations without cutting them
    // mid-sentence; turn length is governed by the prompt's word limits.
    maxTokens: 450,
} as const;

// Voices for the evaluating professor, chosen by the student when uploading the
// research and stored as the key in `books.persona`. Both are Azure Peruvian-
// Spanish neural voices served through Vapi's default Azure integration, so the
// "Spanish only" constraint holds whichever one is picked. Descriptions are
// shown to the student in VoiceSelector, so they are in Spanish.
export const voiceOptions = {
    camila: { id: 'es-PE-CamilaNeural', name: 'Camila', gender: 'female', description: 'Voz femenina · español peruano' },
    alex: { id: 'es-PE-AlexNeural', name: 'Alex', gender: 'male', description: 'Voz masculina · español peruano' },
} as const;

export type VoiceKey = keyof typeof voiceOptions;

// Default voice, also used for books created before the selector existed.
export const DEFAULT_VOICE: VoiceKey = 'camila';

// ElevenLabs voice settings optimized for conversational AI
export const VOICE_SETTINGS = {
    stability: 0.45, // Lower for more emotional, dynamic delivery (0.30-0.50 is natural)
    similarityBoost: 0.75, // Enhances clarity without distortion
    style: 0, // Keep at 0 for conversational AI (higher = more latency, less stable)
    useSpeakerBoost: true, // Improves voice quality
    speed: 1.0, // Natural conversation speed
};

// Azure TTS through Vapi's default integration: no Azure or ElevenLabs key is
// required. The voiceId is the default one; useVapi replaces it with the voice
// the student picked (voiceOptions). Language is fixed by the es-PE voice ID
// instead of inferred from each chunk.
export const VAPI_SPANISH_VOICE = {
    provider: 'azure',
    voiceId: voiceOptions[DEFAULT_VOICE].id,
    speed: 1,
    chunkPlan: {
        enabled: true,
        formatPlan: {
            // Vapi's generic formatter has a 2025 cutoff and may rewrite 2026
            // before synthesis. Let the locale-specific Azure voice normalize
            // dates and numbers directly in Peruvian Spanish.
            enabled: false,
        },
    },
} as const;

// Pin speech recognition to Spanish as well. Keeping this in the call override
// prevents a stale dashboard language from affecting new deployments.
export const VAPI_SPANISH_TRANSCRIBER = {
    provider: 'deepgram',
    model: 'nova-2',
    language: 'es',
    smartFormat: true,
    // Deepgram recommends a longer endpoint for reliable short utterances; it
    // also reduces premature final chunks around natural Spanish pauses.
    endpointing: 300,
} as const;

// A defense answer often contains reflective pauses. This catch-all endpointing
// rule keeps the student's turn open for 2.5 seconds after every transcript
// update; waitSeconds then adds a short final buffer before assistant audio.
// Sent from useVapi on every call, so it does not depend on dashboard drift.
export const VAPI_START_SPEAKING_PLAN = {
    waitSeconds: 0.8,
    customEndpointingRules: [
        {
            type: 'customer',
            regex: '.+',
            timeoutSeconds: 2.5,
        },
    ],
    transcriptionEndpointingPlan: {
        onPunctuationSeconds: 1.5,
        onNoPunctuationSeconds: 2.5,
        onNumberSeconds: 1.5,
    },
} as const;

// Remaining Vapi configuration kept as a dashboard reference. The
// startSpeakingPlan above is applied directly from code.
export const VAPI_DASHBOARD_CONFIG = {
    stopSpeakingPlan: {
        numWords: 2,
        voiceSeconds: 0.2,
        backoffSeconds: 1.0,
    },
    // Timing settings
    silenceTimeoutSeconds: 30,
    responseDelaySeconds: 0.4,
    llmRequestDelaySeconds: 0.1,
    // Conversation features
    backgroundDenoisingEnabled: true,
    backchannelingEnabled: true,
    fillerInjectionEnabled: false,
};


// ============================================
// RETRIEVER CONFIGURATION
// ============================================
// These two values are reported in the thesis as configuration parameters of
// the retriever, so they live here as named constants instead of being buried
// as literals inside the search code.

// The segmentation parameters (window and overlap) live next to the code that
// applies them, in lib/segmentation.ts.

// Maximum number of segments handed to the LLM per retrieval.
// 5 keeps the injected context under ~2500 words, which fits the assistant's
// prompt budget while giving the model more than one page to cite from.
export const RETRIEVER_TOP_K = 5;

// Maximum cosine distance (0 = identical, 1 = orthogonal, 2 = opposite) for a
// segment to be considered relevant. Anything above this is discarded, even if
// it was among the top-K nearest: it is better for the agent to say "that is
// not in your document" than to reason over the least-bad segments.
//
// CALIBRATION CRITERION: with Gemini gemini-embedding-001, a query paraphrasing a
// passage of the same document lands around 0.30-0.45, while an off-topic query
// (asking about cryptocurrencies in an education thesis) lands above 0.70. 0.6
// sits in that gap, closer to the noise side so that a legitimate but loosely
// worded question is not silently dropped.
//
// PROVISIONAL: this value has not yet been tuned against a real thesis PDF —
// the database is still empty (see CLAUDE.md). To calibrate it, ingest a real
// thesis, run ~10 on-topic and ~10 off-topic queries, log the `distance` column
// of `turn_retrievals`, and move the threshold to the midpoint between the worst
// on-topic distance and the best off-topic one. Record the final value and the
// measurements in the thesis.
export const RETRIEVER_MAX_DISTANCE = 0.6;
