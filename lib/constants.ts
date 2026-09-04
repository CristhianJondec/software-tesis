// Brand color - used in JS files where CSS variables aren't available
export const BRAND_COLOR = '#212a3b'; // Dark blue-gray
export const BRAND_COLOR_HOVER = '#3d485e'; // Medium blue-gray

// File validation helpers
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ACCEPTED_PDF_TYPES = ['application/pdf'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Pre-configured VAPI assistant ID (hardcoded for this app)
export const ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID!;

// 11Labs Voice IDs - Optimized for conversational AI
// Voices for the evaluating professor who leads the thesis defense.
// Descriptions are shown to the student in VoiceSelector, so they are in Spanish.
// Do NOT change the voice IDs.
export const voiceOptions = {
    // Male voices
    dave: { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave', description: 'Docente joven, tono cercano y directo' },
    daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Docente de trayectoria, tono firme y sereno' },
    chris: { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', description: 'Docente de trato llano, ritmo pausado' },
    // Female voices
    rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Docente de dicción clara, tono neutral y exigente' },
    sarah: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Docente de tono medido, exigente sin dureza' },
};

// Voice categories for the selector UI
export const voiceCategories = {
    male: ['dave', 'daniel', 'chris'],
    female: ['rachel', 'sarah'],
};

// Default voice
export const DEFAULT_VOICE = 'rachel';

// ElevenLabs voice settings optimized for conversational AI
export const VOICE_SETTINGS = {
    stability: 0.45, // Lower for more emotional, dynamic delivery (0.30-0.50 is natural)
    similarityBoost: 0.75, // Enhances clarity without distortion
    style: 0, // Keep at 0 for conversational AI (higher = more latency, less stable)
    useSpeakerBoost: true, // Improves voice quality
    speed: 1.0, // Natural conversation speed
};

// Fallback TTS used while ElevenLabs is not connected in the Vapi dashboard.
// Vapi's own voice provider ships with the platform and needs no third-party
// credential, so the call cannot fail with assistant.voice.requestFailed.
// Set NEXT_PUBLIC_ELEVENLABS_ENABLED=true to switch back to the ElevenLabs
// voices in `voiceOptions` above (requires the ElevenLabs key in Vapi).
// NOTE: no `language` field on purpose. Vapi rejected es-MX with
// `unsupported_language`: the language list in the SDK types covers every voice
// provider, not what this particular voice supports. Without the field the voice
// falls back to its default and still reads the Spanish text — with an anglophone
// accent. That is acceptable for a smoke test, NOT for the study sessions:
// connect ElevenLabs (or another Spanish TTS) before running them.
export const VAPI_FALLBACK_VOICE = {
    voiceId: 'Clara',
} as const;

// VAPI configuration for natural conversation
// NOTE: These settings should be configured in the VAPI Dashboard for the assistant
// They are kept here for reference and documentation purposes
export const VAPI_DASHBOARD_CONFIG = {
    // Turn-taking settings
    startSpeakingPlan: {
        smartEndpointingEnabled: true,
        waitSeconds: 0.4,
    },
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
