'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Mic, MicOff } from 'lucide-react';

type MicCheckState = 'idle' | 'requesting' | 'listening' | 'ok' | 'silent' | 'error';

// RMS of the time-domain signal (0..1) above which we count it as voice, and how
// long it has to stay there. Low on purpose: it only has to tell a working mic
// from a muted or wrong one, not judge the audio quality.
const VOICE_RMS_THRESHOLD = 0.02;
const VOICE_FRAMES_REQUIRED = 8;
const SILENCE_TIMEOUT_MS = 10_000;

function describeMicError(error: unknown): string {
    const name = error instanceof DOMException ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'El navegador no tiene permiso para usar el micrófono. Haz clic en el candado junto a la dirección de la página, permite el micrófono y vuelve a probar.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        return 'No se encontró ningún micrófono. Conecta uno (o tus audífonos con micrófono) y vuelve a probar.';
    }
    if (name === 'NotReadableError') {
        return 'Otra aplicación está usando el micrófono (Zoom, Meet, WhatsApp…). Ciérrala y vuelve a probar.';
    }
    return 'No se pudo acceder al micrófono. Revisa que esté conectado y vuelve a probar.';
}

/**
 * Pre-session microphone check. The call only starts once the student's voice
 * actually reaches the browser: a muted or wrong microphone otherwise opens a
 * Vapi call that hears nothing and ends with
 * `assistant-did-not-receive-customer-audio`, wasting the session.
 *
 * The stream is released as soon as the check ends, so Vapi can take the
 * microphone afterwards.
 */
export default function MicCheck({ passed, onPassed }: { passed: boolean; onPassed: () => void }) {
    const [state, setState] = useState<MicCheckState>(passed ? 'ok' : 'idle');
    const [level, setLevel] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => () => cleanupRef.current?.(), []);

    const startCheck = async () => {
        cleanupRef.current?.();
        setError(null);
        setLevel(0);
        setState('requesting');

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            setError(describeMicError(err));
            setState('error');
            return;
        }

        setDeviceLabel(stream.getAudioTracks()[0]?.label || null);
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(stream).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);

        let frame = 0;
        let voiceFrames = 0;
        let finished = false;
        const cleanup = () => {
            if (finished) return;
            finished = true;
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
            stream.getTracks().forEach((track) => track.stop());
            void context.close();
        };
        cleanupRef.current = cleanup;

        const timeout = setTimeout(() => {
            cleanup();
            setLevel(0);
            setState('silent');
        }, SILENCE_TIMEOUT_MS);

        const tick = () => {
            analyser.getFloatTimeDomainData(samples);
            let sum = 0;
            for (const sample of samples) sum += sample * sample;
            const rms = Math.sqrt(sum / samples.length);
            setLevel(Math.min(1, rms * 8));

            voiceFrames = rms > VOICE_RMS_THRESHOLD ? voiceFrames + 1 : 0;
            if (voiceFrames >= VOICE_FRAMES_REQUIRED) {
                cleanup();
                setLevel(0);
                setState('ok');
                onPassed();
                return;
            }
            frame = requestAnimationFrame(tick);
        };

        setState('listening');
        frame = requestAnimationFrame(tick);
    };

    if (state === 'ok') {
        return (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c8dcd0] bg-[#eef6f1] p-4">
                <p className="flex items-start gap-2 text-sm text-[#1f4434]">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                        <strong>Micrófono listo.</strong> Te escuchamos bien
                        {deviceLabel ? ` (${deviceLabel})` : ''}.
                    </span>
                </p>
                <button type="button" onClick={startCheck} className="text-xs font-semibold text-[#1f4434] underline">
                    Probar otra vez
                </button>
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-black/10 p-4">
            <p className="text-sm font-semibold text-[#212a3b]">Prueba tu micrófono</p>
            <p className="mt-1 text-sm text-[#3d485e]">
                Antes de empezar, comprueba que el jurado podrá escucharte. Pulsa el botón y di en voz alta
                «Hola, estoy listo para sustentar».
            </p>

            {state === 'listening' && (
                <div className="mt-3">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-black/10" aria-hidden="true">
                        <div
                            className="h-full rounded-full bg-[#2f7a55] transition-[width] duration-75"
                            style={{ width: `${Math.round(level * 100)}%` }}
                        />
                    </div>
                    <p className="mt-2 text-xs text-[#6b7280]" role="status">
                        Escuchando{deviceLabel ? ` con ${deviceLabel}` : ''}… habla ahora.
                    </p>
                </div>
            )}

            {state === 'silent' && (
                <p className="mt-3 flex items-start gap-2 text-sm text-amber-900" role="alert">
                    <MicOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>
                        No se escuchó tu voz{deviceLabel ? ` en ${deviceLabel}` : ''}. Revisa que el micrófono no esté
                        silenciado y que sea el correcto en la configuración de sonido de tu equipo, y vuelve a probar.
                    </span>
                </p>
            )}

            {state === 'error' && error && (
                <p className="mt-3 flex items-start gap-2 text-sm text-red-900" role="alert">
                    <MicOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </p>
            )}

            {state !== 'listening' && (
                <button
                    type="button"
                    onClick={startCheck}
                    disabled={state === 'requesting'}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#212a3b] px-4 py-2 text-sm font-semibold text-[#212a3b] transition-colors hover:bg-[#fff6e5] disabled:opacity-60"
                >
                    {state === 'requesting' ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Mic className="size-4" aria-hidden="true" />
                    )}
                    {state === 'idle' || state === 'requesting' ? 'Probar micrófono' : 'Volver a probar'}
                </button>
            )}
        </div>
    );
}
