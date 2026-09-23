'use client';

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { useSession } from '@/lib/auth-client';

import {
    ASSISTANT_ID,
    EVALUATOR_MODEL,
    MAX_SESSION_DURATION_MINUTES,
    VAPI_FALLBACK_VOICE,
} from '@/lib/constants';
import { buildEvaluatorSystemPrompt } from '@/lib/agent-prompt';
import {
    DEFAULT_DIFFICULTY_LEVEL,
    getDifficultyLevel,
    type DifficultyLevelId,
} from '@/lib/difficulty/levels';
import { buildFocusDirectives } from '@/lib/preparation/focus';
import type { PreparationTopicId } from '@/lib/preparation/topics';
import type { PredictionAnswers } from '@/lib/prediction/questions';
import { IBook, Messages } from '@/types';
import {
    startVoiceSession,
    endVoiceSession,
    linkVapiCall,
    saveSessionTurn,
} from '@/lib/actions/session.actions';
import { recordSessionClosing } from '@/lib/actions/progress.actions';

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

/**
 * How long the evidence-based closing may take to come back from the server
 * before the call is hung up without it (docs/propuestas/05).
 *
 * The student pressed "finalizar": they are owed a hang-up, not a spinner. A
 * closing that does not arrive in time is simply not spoken, and the same
 * evidence still waits for them on the session page.
 */
const CLOSING_FETCH_TIMEOUT_MS = 6_000;

/**
 * Ceiling for the spoken closing itself. `vapi.say(..., true)` ends the call
 * once the text has been spoken; this is the net for the case where that
 * message never lands, so a session can never be left hanging on the line.
 */
const CLOSING_SPEECH_TIMEOUT_MS = 45_000;

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
    // The agent is reading the evidence of the session before hanging up.
    const [isClosing, setIsClosing] = useState(false);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef(false);
    const closingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const lastSavedTurnRef = useRef<string | null>(null);

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
        lastSavedTurnRef.current = null;
    }, []);

    // Persist a closed turn immediately. Fire and forget: a storage failure must
    // never interrupt the conversation in progress.
    const persistTurn = useCallback(
        (role: 'assistant' | 'user', content: string, startedAt: number, endedAt: number) => {
            const sessionId = sessionIdRef.current;
            const trimmed = content?.trim();
            if (!sessionId || !trimmed) return;

            const fingerprint = role + '|' + trimmed;
            if (lastSavedTurnRef.current === fingerprint) return;
            lastSavedTurnRef.current = fingerprint;

            const studentLatencyMs = role === 'user' ? pendingStudentLatencyRef.current : null;
            const systemLatencyMs = role === 'assistant' ? pendingSystemLatencyRef.current : null;
            // A turn with a single partial has no measurable gap, which is not
            // the same as a gap of zero: it is reported as unmeasured.
            const maxPauseMs = role === 'user' && maxUserPauseRef.current > 0 ? maxUserPauseRef.current : null;
            if (role === 'user') pendingStudentLatencyRef.current = null;
            if (role === 'assistant') pendingSystemLatencyRef.current = null;

            saveSessionTurn({
                sessionId,
                turnIndex: turnIndexRef.current++,
                role,
                content: trimmed,
                startedAt,
                endedAt,
                studentLatencyMs,
                systemLatencyMs,
                maxPauseMs,
            })
                .then((res) => {
                    if (!res.success) console.error('Failed to save session turn:', res.error);
                })
                .catch((err) => console.error('Failed to save session turn:', err));
        },
        [],
    );

    // Keep refs in sync with latest values for use in callbacks
    const maxDurationSeconds = MAX_SESSION_DURATION_MINUTES * SECONDS_PER_MINUTE;
    const maxDurationRef = useLatestRef(maxDurationSeconds);
    const durationRef = useLatestRef(duration);

    // Set up Vapi event listeners
    useEffect(() => {
        const handlers = {
            'call-start': () => {
                isStoppingRef.current = false;
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

                        // Check duration limit
                        if (newDuration >= maxDurationRef.current) {
                            getVapi().stop();
                            setLimitError(
                                `La sesión alcanzó el límite de ${Math.floor(
                                    maxDurationRef.current / SECONDS_PER_MINUTE,
                                )} minutos.`,
                            );
                        }
                    }
                }, TIMER_INTERVAL_MS);
            },

            'call-end': () => {
                // Don't reset isStoppingRef here - delayed events may still fire
                setStatus('idle');
                setIsClosing(false);
                if (closingTimeoutRef.current) {
                    clearTimeout(closingTimeoutRef.current);
                    closingTimeoutRef.current = null;
                }
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
                    // Only a session that produced turns gets a closing self-report:
                    // asking after a call that never connected would store noise.
                    if (turnIndexRef.current > 0) setFinishedSessionId(sessionIdRef.current);
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session:', err),
                    );
                    sessionIdRef.current = null;
                }

                startTimeRef.current = null;
            },

            'speech-start': () => {
                const now = Date.now();
                agentTurnStartedAtRef.current = now;

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
            }) => {
                if (message.type !== 'transcript') return;

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

                // Partial AI transcript → show word-by-word
                if (message.role === 'assistant' && message.transcriptType === 'partial') {
                    setCurrentMessage(message.transcript);
                    return;
                }

                // Final transcript → add to messages
                if (message.transcriptType === 'final') {
                    if (message.role === 'assistant') setCurrentMessage('');
                    if (message.role === 'user') setCurrentUserMessage('');

                    // Persist the closed turn right away, not at the end of the call.
                    const endedAt = Date.now();
                    if (message.role === 'user' || message.role === 'assistant') {
                        const startedAt =
                            (message.role === 'user'
                                ? userTurnStartedAtRef.current
                                : agentTurnStartedAtRef.current) ?? endedAt;

                        persistTurn(message.role, message.transcript, startedAt, endedAt);

                        if (message.role === 'user') {
                            userTurnStartedAtRef.current = null;
                            lastUserPartialAtRef.current = null;
                            maxUserPauseRef.current = 0;
                        } else {
                            agentTurnStartedAtRef.current = null;
                        }
                    }

                    setMessages((prev) => {
                        const isDupe = prev.some(
                            (m) => m.role === message.role && m.content === message.transcript,
                        );
                        return isDupe ? prev : [...prev, { role: message.role, content: message.transcript }];
                    });
                }
            },

            error: (error: Error) => {
                console.error('Vapi error:', error);
                // Don't reset isStoppingRef here - delayed events may still fire
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
                    if (turnIndexRef.current > 0) setFinishedSessionId(sessionIdRef.current);
                    endVoiceSession(sessionIdRef.current, durationRef.current).catch((err) =>
                        console.error('Failed to end voice session on error:', err),
                    );
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
            if (closingTimeoutRef.current) clearTimeout(closingTimeoutRef.current);
        };
    }, [durationRef, maxDurationRef, persistTurn, resetTurnTracking]);

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

            // Investfied currently exposes one voice only. The old ElevenLabs
            // choices remain documented in constants.ts and VoiceSelector.tsx for
            // the future multi-voice phase, but are deliberately not read here.
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
                    provider: 'vapi' as const,
                    voiceId: VAPI_FALLBACK_VOICE.voiceId,
                },
                // Research sessions keep transcripts and metrics, but no audio
                // recording is created or exposed.
                artifactPlan: {
                    recordingEnabled: false,
                },
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
    }, [book.id, book.title, book.author, userId]);

    /**
     * Ends the session, letting the agent read the evidence of it first
     * (docs/propuestas/05).
     *
     * The closing sentences are composed on the server by
     * `lib/progress/closing.ts` and handed to the TTS verbatim through
     * `vapi.say`, which hangs up once they have been spoken. The LLM is not
     * asked to summarise anything: that is what makes "el cierre incluye
     * evidencias, no elogios genéricos" a property of the code instead of a
     * hope about a sampler.
     *
     * Every failure path ends the call anyway. A student who pressed "finalizar"
     * must never be kept on the line by a closing that could not be built.
     */
    const stop = useCallback(async () => {
        if (isStoppingRef.current) return;
        isStoppingRef.current = true;

        const sessionId = sessionIdRef.current;
        if (!sessionId) {
            getVapi().stop();
            return;
        }

        setIsClosing(true);

        try {
            const closing = await Promise.race([
                recordSessionClosing(sessionId),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), CLOSING_FETCH_TIMEOUT_MS),
                ),
            ]);

            const spokenText = closing?.success ? closing.data?.spokenText : null;

            if (spokenText) {
                // `true` = end the call once the text has been spoken.
                getVapi().say(spokenText, true);
                closingTimeoutRef.current = setTimeout(() => {
                    closingTimeoutRef.current = null;
                    getVapi().stop();
                }, CLOSING_SPEECH_TIMEOUT_MS);
                return;
            }
        } catch (err) {
            console.error('Failed to build the spoken closing:', err);
        }

        setIsClosing(false);
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
        isClosing,
        limitError,
        maxDurationSeconds,
        clearError,
        activeLevel,
        finishedSessionId,
        clearFinishedSession,
    };
}

export default useVapi;
