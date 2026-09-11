'use client';

// Create hooks/useVapi.ts: the core hook. Initializes Vapi SDK, manages call lifecycle (idle, connecting, starting, listening, thinking, speaking), tracks messages array + currentMessage streaming, handles duration timer with maxDuration enforcement, session tracking via server actions

import { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';
import { useSession } from '@/lib/auth-client';

import {
    ASSISTANT_ID,
    MAX_SESSION_DURATION_MINUTES,
    VAPI_FALLBACK_VOICE,
} from '@/lib/constants';
import { IBook, Messages } from '@/types';
import {
    startVoiceSession,
    endVoiceSession,
    linkVapiCall,
    saveSessionTurn,
} from '@/lib/actions/session.actions';

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

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const sessionIdRef = useRef<string | null>(null);
    const isStoppingRef = useRef(false);

    // --- Turn instrumentation (refs only: these must not re-render the UI) ---
    const turnIndexRef = useRef(0);
    // Set when the agent stops speaking; consumed by the student's first word.
    const agentSpeechEndAtRef = useRef<number | null>(null);
    // Set on the student's final transcript; consumed by the agent's next speech-start.
    const userFinalAtRef = useRef<number | null>(null);
    const pendingStudentLatencyRef = useRef<number | null>(null);
    const pendingSystemLatencyRef = useRef<number | null>(null);
    const userTurnStartedAtRef = useRef<number | null>(null);
    const agentTurnStartedAtRef = useRef<number | null>(null);
    const lastSavedTurnRef = useRef<string | null>(null);

    const resetTurnTracking = useCallback(() => {
        turnIndexRef.current = 0;
        agentSpeechEndAtRef.current = null;
        userFinalAtRef.current = null;
        pendingStudentLatencyRef.current = null;
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

                        if (message.role === 'user') userTurnStartedAtRef.current = null;
                        else agentTurnStartedAtRef.current = null;
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
        };
    }, [durationRef, maxDurationRef, persistTurn, resetTurnTracking]);

    const start = useCallback(async () => {
        if (!userId) {
            setLimitError('Inicia sesión para comenzar una conversación por voz.');
            return;
        }

        setLimitError(null);
        setStatus('connecting');

        try {
            // Create the persisted session before connecting to Vapi.
            const result = await startVoiceSession(book.id);

            if (!result.success) {
                setLimitError(result.error || 'No se pudo iniciar la sesión. Inténtalo nuevamente.');
                setStatus('idle');
                return;
            }

            sessionIdRef.current = result.sessionId || null;
            // Opening of the thesis defense. Sent from here — not from the Vapi dashboard —
            // because it interpolates the actual thesis title. See docs/agente/.
            const firstMessage = `Buen día. Soy parte del jurado que evaluará su investigación, "${book.title}". Cuénteme brevemente de qué trata y en qué punto se encuentra; luego iniciaré las preguntas.`;


            // Investfied currently exposes one voice only. The old ElevenLabs
            // choices remain documented in constants.ts and VoiceSelector.tsx for
            // the future multi-voice phase, but are deliberately not read here.
            const assistantOverrides = {
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

            const localSessionId = result.sessionId ?? '';
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

    const stop = useCallback(() => {
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
    };
}

export default useVapi;
