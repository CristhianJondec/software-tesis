'use client';

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { useSession } from '@/lib/auth-client';

import {
    ASSISTANT_ID,
    EVALUATOR_MODEL,
    MAX_SESSION_DURATION_MINUTES,
    SESSION_WRAP_UP_MINUTES_BEFORE_END,
    VAPI_MAX_DURATION_BUFFER_SECONDS,
    VAPI_SPANISH_TRANSCRIBER,
    VAPI_SPANISH_VOICE,
    VAPI_START_SPEAKING_PLAN,
} from '@/lib/constants';
import { buildEvaluatorSystemPrompt, buildWrapUpMessage } from '@/lib/agent-prompt';
import {
    DEFAULT_DIFFICULTY_LEVEL,
    getDifficultyLevel,
    type DifficultyLevelId,
} from '@/lib/difficulty/levels';
import { buildFocusDirectives } from '@/lib/preparation/focus';
import type { PreparationTopicId } from '@/lib/preparation/topics';
import type { PredictionAnswers } from '@/lib/prediction/questions';
import { IBook, Messages } from '@/types';
import { getVoice } from '@/lib/utils';
import {
    startVoiceSession,
    endVoiceSession,
    linkVapiCall,
    saveSessionTurn,
    updateSessionTurn,
} from '@/lib/actions/session.actions';
import {
    mergeAdjacentTranscriptMessage,
    mergeTranscriptFragments,
} from '@/lib/transcript';

export interface StartSessionOptions {
    /** Level confirmed on the pre-session screen. The server has the last word. */
    difficultyLevel?: DifficultyLevelId;
    /** Self-report 0-10 taken right before starting. Null when skipped. */
    preSessionAnxiety?: number | null;
    /** Topics of the preparation map this session is limited to, if any. */
    focusTopics?: PreparationTopicId[];
    /** The three written predictions taken before connecting, if answered. */
    prediction?: PredictionAnswers;
}

export function useLatestRef<T>(value: T) {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref;
}

const VAPI_API_KEY = process.env.NEXT_PUBLIC_VAPI_API_KEY;
const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;

/** Joins TTS chunks into one readable text, without doubled spaces. */
function joinSpokenChunks(chunks: string[]): string {
    return chunks.join(' ').replace(/\s+/g, ' ').trim();
}

let vapi: InstanceType<typeof Vapi>;
function getVapi() {
    if (!vapi) {
        if (!VAPI_API_KEY) {
            throw new Error('NEXT_PUBLIC_VAPI_API_KEY environment variable is not set');
        }
        vapi = new Vapi(VAPI_API_KEY);
    }
    return vapi;
}

type TranscriptRole = 'assistant' | 'user';

interface ActivePersistedTurn {
    role: TranscriptRole;
    content: string;
    endedAt: number;
    maxPauseMs: number | null;
    turnIdPromise: Promise<string | null>;
    updateQueue: Promise<void>;
}

export type CallStatus = 'idle' | 'connecting' | 'starting' | 'listening' | 'thinking' | 'speaking';

export function useVapi(book: IBook) {
    const { data: session } = useSession();
    const userId = session?.user?.id;

    const [status, setStatus] = useState<CallStatus>('idle');
    const [messages, setMessages] = useState<Messages[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [duration, setDuration] = useState(0);
    const [limitError, setLimitError] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    // Level the live session is running at, so the UI can name it while it runs.
    const [activeLevel, setActiveLevel] = useState<DifficultyLevelId>(DEFAULT_DIFFICULTY_LEVEL);
    // Session that just closed, still awaiting its post-session self-report.
    const [finishedSessionId, setFinishedSessionId] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef(false);
    // Whether the agent was already told to move to the closing in this call.
    const wrapUpSentRef = useRef(false);
    // Every in-flight turn save, so the post-session modal only opens once the
    // whole session is in the database and its summary can include the last turn.
    const pendingSavesRef = useRef<Set<Promise<unknown>>>(new Set());

    // --- What the agent says, exactly as it was sent to the TTS ---
    // Vapi's assistant `transcript` events are a re-transcription of the agent's
    // audio, so terms the TTS pronounces in Spanish (English names, acronyms)
    // come back mangled. `voice-input` carries the literal text each TTS chunk
    // was generated from; the transcript events are only a fallback.
    const assistantChunksRef = useRef<string[]>([]);
    const assistantFallbackRef = useRef<string[]>([]);
    const agentSpeechLastEndRef = useRef<number | null>(null);

    // --- Turn instrumentation (refs only: these must not re-render the UI) ---
    const turnIndexRef = useRef(0);
    // Set when the agent stops speaking; consumed by the student's first word.
    const agentSpeechEndAtRef = useRef<number | null>(null);
    // Set on the student's final transcript; consumed by the agent's next speech-start.
    const userFinalAtRef = useRef<number | null>(null);
    const pendingStudentLatencyRef = useRef<number | null>(null);
    // Longest gap between two consecutive partial transcripts of the student's
    // current turn, and when the last partial arrived. Feeds dimension 3 of the
    // post-session report (docs/propuestas/02). It measures silence as the
    // transcriber saw it, not acoustic silence — see database/schema/sessionTurns.ts.
    const lastUserPartialAtRef = useRef<number | null>(null);
    const maxUserPauseRef = useRef<number>(0);
    const pendingSystemLatencyRef = useRef<number | null>(null);
    const userTurnStartedAtRef = useRef<number | null>(null);
    const agentTurnStartedAtRef = useRef<number | null>(null);
    // Consecutive `final` events from the same speaker are fragments of one
    // logical intervention. Keep its row so later chunks extend it instead of
    // inflating answer counts and session metrics.
    const activePersistedTurnRef = useRef<ActivePersistedTurn | null>(null);

    const resetTurnTracking = useCallback(() => {
        turnIndexRef.current = 0;
        agentSpeechEndAtRef.current = null;
        userFinalAtRef.current = null;
        pendingStudentLatencyRef.current = null;
        lastUserPartialAtRef.current = null;
        maxUserPauseRef.current = 0;
        pendingSystemLatencyRef.current = null;
        userTurnStartedAtRef.current = null;
        agentTurnStartedAtRef.current = null;
        activePersistedTurnRef.current = null;
        assistantChunksRef.current = [];
        assistantFallbackRef.current = [];
        agentSpeechLastEndRef.current = null;
    }, []);

    const trackSave = useCallback((promise: Promise<unknown>) => {
        pendingSavesRef.current.add(promise);
        void promise.finally(() => pendingSavesRef.current.delete(promise));
    }, []);

    // Persist the first final chunk immediately so retrievals can anchor to it.
    // Further final chunks from the same speaker update that same database row.
    const persistTurn = useCallback(
        (role: TranscriptRole, content: string, startedAt: number, endedAt: number) => {
            const sessionId = sessionIdRef.current;
            const trimmed = content?.trim();
            if (!sessionId || !trimmed) return;

            const maxPauseMs = role === 'user' && maxUserPauseRef.current > 0 ? maxUserPauseRef.current : null;
            const active = activePersistedTurnRef.current;

            if (active?.role === role) {
                const merged = mergeTranscriptFragments(active.content, trimmed);
                active.content = merged;
                active.endedAt = endedAt;
                active.maxPauseMs =
                    role === 'user'
                        ? Math.max(active.maxPauseMs ?? 0, maxPauseMs ?? 0) || null
                        : null;

                const snapshot = {
                    content: active.content,
                    endedAt: active.endedAt,
                    maxPauseMs: active.maxPauseMs,
                };

                // Serialize updates so a slower request can never overwrite a
                // newer, longer version of the same turn.
                active.updateQueue = active.updateQueue.then(async () => {
                    const turnId = await active.turnIdPromise;
                    if (!turnId) return;
                    const result = await updateSessionTurn({ turnId, ...snapshot });
                    if (!result.success) {
                        console.error('Failed to extend session turn:', result.error);
                    }
                });
                trackSave(active.updateQueue);
                return;
            }

            const studentLatencyMs = role === 'user' ? pendingStudentLatencyRef.current : null;
            const systemLatencyMs = role === 'assistant' ? pendingSystemLatencyRef.current : null;
            if (role === 'user') pendingStudentLatencyRef.current = null;
            if (role === 'assistant') pendingSystemLatencyRef.current = null;

            const turnIndex = turnIndexRef.current++;
            const turnIdPromise = saveSessionTurn({
                sessionId,
                turnIndex,
                role,
                content: trimmed,
                startedAt,
                endedAt,
                studentLatencyMs,
                systemLatencyMs,
                maxPauseMs,
            })
                .then((result) => {
                    if (!result.success) {
                        console.error('Failed to save session turn:', result.error);
                        return null;
                    }
                    return result.turnId ?? null;
                })
                .catch((error) => {
                    console.error('Failed to save session turn:', error);
                    return null;
                });
            trackSave(turnIdPromise);

            activePersistedTurnRef.current = {
                role,
                content: trimmed,
                endedAt,
                maxPauseMs,
                turnIdPromise,
                updateQueue: Promise.resolve(),
            };
        },
        [trackSave],
    );

    /**
     * Closes the agent's current intervention: shows it as a finished bubble and
     * persists it. Called when the student starts talking and when the call ends,
     * because the TTS text arrives in chunks with no "turn finished" marker.
     */
    const commitAssistantTurn = useCallback(() => {
        const chunks = assistantChunksRef.current;
        const content = joinSpokenChunks(
            chunks.length > 0 ? chunks : assistantFallbackRef.current,
        );
        assistantChunksRef.current = [];
        assistantFallbackRef.current = [];
        if (!content) return;

        const endedAt = agentSpeechLastEndRef.current ?? Date.now();
        const startedAt = agentTurnStartedAtRef.current ?? endedAt;
        persistTurn('assistant', content, startedAt, endedAt);

        setCurrentMessage('');
        setMessages((prev) =>
            mergeAdjacentTranscriptMessage(prev, { role: 'assistant', content }),
        );
    }, [persistTurn]);

    // Cap of the current session. The server may shorten it to the voice time
    // the account has left (lib/study/usage.ts), so it is state, not a constant.
    const [maxDurationSeconds, setMaxDurationSeconds] = useState(
        MAX_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE,
    );
    // Written synchronously in start(): the timer must see the new cap from its
    // first tick, before React has re-rendered.
    const maxDurationRef = useRef(maxDurationSeconds);
    const durationRef = useLatestRef(duration);
    // Set up Vapi event listeners
    useEffect(() => {
        const handlers = {
            'call-start': () => {
                isStoppingRef.current = false;
                wrapUpSentRef.current = false;
                resetTurnTracking();
                setStatus('starting'); // AI speaks first, wait for it
                setCurrentMessage('');
                setCurrentUserMessage('');
                setIsMuted(false);

                // Start duration timer
                startTimeRef.current = Date.now();
                setDuration(0);
                timerRef.current = setInterval(() => {
                    if (startTimeRef.current) {
                        const newDuration = Math.floor((Date.now() - startTimeRef.current) / TIMER_INTERVAL_MS);
                        setDuration(newDuration);

                        // Near the cap: tell the agent to close. It is added to the
                        // context without forcing a reply, so it never talks over
                        // the student; it takes effect on the agent's next turn.
                        // A session shortened by the account's time cap gets a
                        // proportionally shorter warning, so it is not told to
                        // close right after the opening.
                        const wrapUpLeadSeconds = Math.min(
                            SESSION_WRAP_UP_MINUTES_BEFORE_END * SECONDS_PER_MINUTE,
                            Math.floor(maxDurationRef.current / 3),
                        );
                        const wrapUpAt = maxDurationRef.current - wrapUpLeadSeconds;
                        if (!wrapUpSentRef.current && newDuration >= wrapUpAt) {
                            wrapUpSentRef.current = true;
                            getVapi().send({
                                type: 'add-message',
                                message: {
                                    role: 'system',
                                    content: buildWrapUpMessage(
                                        Math.max(1, Math.round(wrapUpLeadSeconds / SECONDS_PER_MINUTE)),
                                    ),
                                },
                                triggerResponseEnabled: false,
                            });
                        }

                        // Check duration limit
                        if (newDuration >= maxDurationRef.current && !isStoppingRef.current) {
                            isStoppingRef.current = true;
                            getVapi().stop();
                            setLimitError(
                                maxDurationRef.current < MAX_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE
                                    ? 'Se agotó el tiempo total de uso del agente asignado a tu cuenta.'
                                    : `La sesión alcanzó el límite de ${MAX_SESSION_DURATION_MINUTES} minutos.`,
                            );
                        }
                    }
                }, TIMER_INTERVAL_MS);
            },

            'call-end': () => {
                // Don't reset isStoppingRef here - delayed events may still fire
                commitAssistantTurn();
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');
                setIsMuted(false);

                // Stop timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking
                if (sessionIdRef.current) {
                    const endedSessionId = sessionIdRef.current;
                    endVoiceSession(endedSessionId, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session:', err),
                    );
                    // Only a session that produced turns gets a closing self-report:
                    // asking after a call that never connected would store noise.
                    // The modal waits for the last turn saves, so the written
                    // summary it shows covers the whole session.
                    if (turnIndexRef.current > 0) {
                        void Promise.allSettled([...pendingSavesRef.current]).then(() =>
                            setFinishedSessionId(endedSessionId),
                        );
                    }
                    sessionIdRef.current = null;
                }

                startTimeRef.current = null;
            },

            'speech-start': () => {
                const now = Date.now();
                // A new agent intervention starts only if the previous one was
                // already closed; a second speech burst in the same turn (e.g.
                // after a tool call) keeps the original start time.
                const agentTurnOpen =
                    activePersistedTurnRef.current?.role === 'assistant' ||
                    assistantChunksRef.current.length > 0 ||
                    assistantFallbackRef.current.length > 0;
                if (!agentTurnOpen) {
                    agentTurnStartedAtRef.current = now;
                }

                // The agent taking the floor definitively closes the student's
                // logical turn. Only now reset the partial-transcript tracking.
                userTurnStartedAtRef.current = null;
                lastUserPartialAtRef.current = null;
                maxUserPauseRef.current = 0;

                // System latency: student stopped talking -> agent starts replying.
                if (userFinalAtRef.current !== null) {
                    pendingSystemLatencyRef.current = now - userFinalAtRef.current;
                    userFinalAtRef.current = null;
                }

                if (!isStoppingRef.current) {
                    setStatus('speaking');
                }
            },
            'speech-end': () => {
                // Starts the clock for the student's verbal response latency.
                agentSpeechEndAtRef.current = Date.now();
                agentSpeechLastEndRef.current = agentSpeechEndAtRef.current;

                if (!isStoppingRef.current) {
                    // After AI finishes speaking, user can talk
                    setStatus('listening');
                }
            },

            message: (message: {
                type: string;
                role: string;
                transcriptType: string;
                transcript: string;
                input?: string;
            }) => {
                // Literal text of each TTS chunk: the source of truth for what the
                // agent says, shown live while it speaks.
                if (message.type === 'voice-input') {
                    const chunk = message.input?.trim();
                    if (!chunk) return;
                    assistantChunksRef.current.push(chunk);
                    setCurrentMessage(joinSpokenChunks(assistantChunksRef.current));
                    return;
                }

                // Diagnostic only: tells an agent cut by student speech or noise
                // (stopSpeakingPlan, dashboard) apart from one cut by maxTokens.
                if (message.type === 'user-interrupted') {
                    console.info('[vapi] agent interrupted by the student', {
                        spokenSoFar: joinSpokenChunks(assistantChunksRef.current),
                    });
                    return;
                }

                if (message.type !== 'transcript') return;

                // The student taking the floor closes the agent's intervention.
                if (message.role === 'user') commitAssistantTurn();

                // User finished speaking → AI is thinking
                if (message.role === 'user' && message.transcriptType === 'final') {
                    // Marks the start of the system latency window.
                    userFinalAtRef.current = Date.now();

                    if (!isStoppingRef.current) {
                        setStatus('thinking');
                    }
                    setCurrentUserMessage('');
                }

                // Partial user transcript → show real-time typing
                if (message.role === 'user' && message.transcriptType === 'partial') {
                    const now = Date.now();

                    // Student latency: first word after the agent stopped speaking.
                    // The marker is cleared so the same turn is never measured twice.
                    if (agentSpeechEndAtRef.current !== null) {
                        pendingStudentLatencyRef.current = now - agentSpeechEndAtRef.current;
                        agentSpeechEndAtRef.current = null;
                    }
                    if (userTurnStartedAtRef.current === null) {
                        userTurnStartedAtRef.current = now;
                    }

                    if (lastUserPartialAtRef.current !== null) {
                        const gap = now - lastUserPartialAtRef.current;
                        if (gap > maxUserPauseRef.current) maxUserPauseRef.current = gap;
                    }
                    lastUserPartialAtRef.current = now;

                    setCurrentUserMessage(message.transcript);
                    return;
                }

                // Agent transcripts are a re-transcription of its audio: they are
                // only shown and stored when no `voice-input` text arrived.
                if (message.role === 'assistant') {
                    if (message.transcriptType === 'final' && message.transcript?.trim()) {
                        assistantFallbackRef.current.push(message.transcript);
                    }
                    if (assistantChunksRef.current.length === 0) {
                        const fallback = joinSpokenChunks(assistantFallbackRef.current);
                        setCurrentMessage(
                            message.transcriptType === 'partial'
                                ? joinSpokenChunks([fallback, message.transcript ?? ''])
                                : fallback,
                        );
                    }
                    return;
                }

                // Final student transcript → add to messages
                if (message.role === 'user' && message.transcriptType === 'final') {
                    setCurrentUserMessage('');

                    // Persist the closed turn right away, not at the end of the call.
                    const endedAt = Date.now();
                    const startedAt = userTurnStartedAtRef.current ?? endedAt;
                    persistTurn('user', message.transcript, startedAt, endedAt);

                    setMessages((prev) =>
                        mergeAdjacentTranscriptMessage(prev, {
                            role: message.role,
                            content: message.transcript,
                        }),
                    );
                }
            },

            error: (error: Error) => {
                console.error('Vapi error:', error);
                // Don't reset isStoppingRef here - delayed events may still fire
                commitAssistantTurn();
                setStatus('idle');
                setCurrentMessage('');
                setCurrentUserMessage('');

                // Stop timer on error
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }

                // End session tracking on error
                if (sessionIdRef.current) {
                    const endedSessionId = sessionIdRef.current;
                    endVoiceSession(endedSessionId, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session on error:', err),
                    );
                    if (turnIndexRef.current > 0) {
                        void Promise.allSettled([...pendingSavesRef.current]).then(() =>
                            setFinishedSessionId(endedSessionId),
                        );
                    }
                    sessionIdRef.current = null;
                }

                // Show user-friendly error message
                const errorMessage = error.message?.toLowerCase() || '';
                if (errorMessage.includes('timeout') || errorMessage.includes('silence')) {
                    setLimitError('La sesión terminó por inactividad. Presiona el micrófono para intentarlo otra vez.');
                } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
                    setLimitError('Se perdió la conexión. Revisa tu internet e inténtalo otra vez.');
                } else {
                    setLimitError('La sesión terminó inesperadamente. Presiona el micrófono para intentarlo otra vez.');
                }

                startTimeRef.current = null;
            },
        };

        // Register all handlers
        Object.entries(handlers).forEach(([event, handler]) => {
            getVapi().on(event as keyof typeof handlers, handler as () => void);
        });

        return () => {
            // End active session on unmount
            if (sessionIdRef.current) {
                commitAssistantTurn();
                getVapi().stop();
                // We intentionally need the latest duration at unmount, not the
                // value captured when the listeners were registered.
                // eslint-disable-next-line react-hooks/exhaustive-deps
                endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                    console.error('Failed to end voice session on unmount:', err),
                );
                sessionIdRef.current = null;
            }
            // Cleanup handlers
            Object.entries(handlers).forEach(([event, handler]) => {
                getVapi().off(event as keyof typeof handlers, handler as () => void);
            });
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [commitAssistantTurn, durationRef, maxDurationRef, persistTurn, resetTurnTracking]);

    const start = useCallback(async (options: StartSessionOptions = {}) => {
        if (!userId) {
            setLimitError('Inicia sesión para comenzar una conversación por voz.');
            return;
        }

        setLimitError(null);
        setFinishedSessionId(null);
        setStatus('connecting');

        try {
            // Create the persisted session before connecting to Vapi.
            const result = await startVoiceSession(book.id, {
                difficultyLevel: options.difficultyLevel,
                preSessionAnxiety: options.preSessionAnxiety ?? null,
                focusTopics: options.focusTopics,
                prediction: options.prediction,
            });

            if (!result.success) {
                setLimitError(result.error || 'No se pudo iniciar la sesión. Inténtalo nuevamente.');
                setStatus('idle');
                return;
            }

            sessionIdRef.current = result.sessionId || null;

            const sessionCapSeconds =
                result.maxDurationSeconds ?? MAX_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE;
            maxDurationRef.current = sessionCapSeconds;
            setMaxDurationSeconds(sessionCapSeconds);

            // The level the SERVER stored, not the one the screen proposed: the
            // simulation the student lives has to match the row the thesis reads.
            const level = getDifficultyLevel(result.difficultyLevel);
            setActiveLevel(level.id);

            // Opening of the thesis defense. Sent from here — not from the Vapi dashboard —
            // because it interpolates the actual thesis title and varies by level.
            // See docs/agente/ and lib/difficulty/levels.ts.
            const firstMessage = level.buildFirstMessage(book.title);

            const localSessionId = result.sessionId ?? '';

            // Focused session: the topics the SERVER accepted, never the ones the
            // screen proposed, so the prompt and the stored row cannot disagree.
            const focusDirectives = buildFocusDirectives(result.focusTopics ?? []);

            // The student picks a male or female Azure Peruvian-Spanish voice when
            // uploading the research (books.persona). Served through Vapi's default
            // integration, so no separate Azure or ElevenLabs credential is needed.
            const voiceId = getVoice(book.persona ?? undefined).id;
            const assistantOverrides = {
                // The agent's behaviour is versioned in the repo, not in the Vapi
                // dashboard. Vapi merges this override onto the assistant, so the
                // searchBook tool attached there survives; if a test session ever
                // shows the agent asking generic questions without hitting the
                // webhook, the tool was dropped and must be sent here as toolIds.
                model: {
                    ...EVALUATOR_MODEL,
                    // The level tunes decoding: level 1 needs a predictable,
                    // repetitive examiner; level 4 needs varied challenges.
                    temperature: level.temperature,
                    messages: [
                        {
                            role: 'system' as const,
                            content: buildEvaluatorSystemPrompt({
                                title: book.title,
                                author: book.author,
                                bookId: book.id,
                                sessionId: localSessionId,
                                levelDirectives: level.promptDirectives,
                                focusDirectives,
                            }),
                        },
                    ],
                },
                voice: {
                    provider: VAPI_SPANISH_VOICE.provider,
                    voiceId,
                    speed: VAPI_SPANISH_VOICE.speed,
                    chunkPlan: {
                        ...VAPI_SPANISH_VOICE.chunkPlan,
                        formatPlan: {
                            ...VAPI_SPANISH_VOICE.chunkPlan.formatPlan,
                        },
                    },
                },
                transcriber: {
                    ...VAPI_SPANISH_TRANSCRIBER,
                },
                startSpeakingPlan: {
                    ...VAPI_START_SPEAKING_PLAN,
                    customEndpointingRules: [
                        ...VAPI_START_SPEAKING_PLAN.customEndpointingRules,
                    ],
                },
                // Vapi's own cap, pinned so the dashboard default (10 min) can
                // never end a session before the app's limit does.
                maxDurationSeconds: sessionCapSeconds + VAPI_MAX_DURATION_BUFFER_SECONDS,
                // Research sessions keep transcripts and metrics, but no audio
                // recording is created or exposed.
                artifactPlan: {
                    recordingEnabled: false,
                },
                // Vapi's default list, pinned here so a dashboard edit can never
                // drop `voice-input`: the literal text of what the agent says,
                // which the live transcript and the stored turns are built from.
                clientMessages: [
                    'conversation-update',
                    'function-call',
                    'hang',
                    'model-output',
                    'speech-update',
                    'status-update',
                    'transfer-update',
                    'transcript',
                    'tool-calls',
                    'user-interrupted',
                    'voice-input',
                    // The SDK's generated type declares a single value, but the API
                    // takes an array (see its own @example); cast around the typo.
                ] as unknown as 'voice-input',
            };

            const call = await getVapi().start(ASSISTANT_ID, {
                firstMessage,
                variableValues: {
                    title: book.title,
                    author: book.author,
                    bookId: book.id,
                    // Comes back on every searchBook tool call so the webhook can
                    // link the retrieved segments to this session.
                    sessionId: localSessionId,
                },
                ...assistantOverrides,
            });

            if (call?.id && localSessionId) {
                linkVapiCall(localSessionId, call.id)
                    .then((linkResult) => {
                        if (!linkResult.success) {
                            console.error('Failed to link the Vapi call:', linkResult.error);
                        }
                    })
                    .catch((linkError) => console.error('Failed to link the Vapi call:', linkError));
            }
        } catch (err) {
            console.error('Failed to start call:', err);
            setStatus('idle');
            setLimitError(
                'No se pudo iniciar la conversación. Revisa tu conexión, el permiso del micrófono y la disponibilidad de los servicios externos.',
            );
        }
    }, [book.id, book.title, book.author, book.persona, userId]);

    /**
     * Hangs up immediately. The session summary is no longer spoken by the
     * agent: it is shown in writing in the post-session modal.
     */
    const stop = useCallback(() => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;
        getVapi().stop();
    }, []);

    const toggleMuted = useCallback(() => {
        const next = !getVapi().isMuted();
        getVapi().setMuted(next);
        setIsMuted(next);
    }, []);

    const clearError = useCallback(() => {
        setLimitError(null);
    }, []);

    const clearFinishedSession = useCallback(() => {
        setFinishedSessionId(null);
    }, []);

    const isActive =
        status === 'starting' ||
        status === 'listening' ||
        status === 'thinking' ||
        status === 'speaking';

    return {
        status,
        isActive,
        messages,
        currentMessage,
        currentUserMessage,
        duration,
        start,
        stop,
        isMuted,
        toggleMuted,
        limitError,
        maxDurationSeconds,
        clearError,
        activeLevel,
        finishedSessionId,
        clearFinishedSession,
    };
}

export default useVapi;
