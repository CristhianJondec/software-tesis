'use client';

import { History, HelpCircle, Mic, MicOff, Play, PhoneOff } from "lucide-react";
import useVapi from "@/hooks/useVapi";
import {IBook} from "@/types";
import Image from "next/image";
import Link from "next/link";
import Transcript from "@/components/Transcript";
import {toast} from "sonner";

import {useEffect, useRef, useState} from "react";

const VapiControls = ({ book }: { book: IBook }) => {
    const { status, isActive, messages, currentMessage, currentUserMessage, duration, start, stop, isMuted, toggleMuted, clearError, limitError, maxDurationSeconds } = useVapi(book)
    const [showRequirements, setShowRequirements] = useState(false);
    const requirementsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (limitError) {
            toast.error(limitError);
            clearError();
        }
    }, [limitError, clearError]);

    useEffect(() => {
        if (!showRequirements) return;

        const handlePointerDown = (event: MouseEvent) => {
            if (requirementsRef.current && !requirementsRef.current.contains(event.target as Node)) {
                setShowRequirements(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowRequirements(false);
        };

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showRequirements]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getStatusDisplay = () => {
        switch (status) {
            case 'connecting': return { label: 'Conectando...', color: 'vapi-status-dot-connecting' };
            case 'starting': return { label: 'Iniciando...', color: 'vapi-status-dot-starting' };
            case 'listening': return { label: 'Escuchando', color: 'vapi-status-dot-listening' };
            case 'thinking': return { label: 'Pensando...', color: 'vapi-status-dot-thinking' };
            case 'speaking': return { label: 'Hablando', color: 'vapi-status-dot-speaking' };
            default: return { label: 'Listo', color: 'vapi-status-dot-ready' };
        }
    };

    const statusDisplay = getStatusDisplay();

    return (
        <>
            <div className="max-w-4xl mx-auto flex flex-col gap-8">
                {/* Header Card */}
                <div className="vapi-header-card">
                    <div className="vapi-cover-wrapper">
                        <Image
                            src={`/api/cover/${book.id}`}
                            alt={book.title}
                            width={120}
                            height={180}
                            className="vapi-cover-image !w-[120px] !h-auto"
                            priority
                            unoptimized
                        />
                        <div className="vapi-mic-wrapper relative">
                            {isActive && (status === 'speaking' || status === 'thinking') && (
                                <div className="absolute inset-0 rounded-full bg-white animate-ping opacity-75" />
                            )}
                            <button
                                onClick={isActive ? stop : start}
                                disabled={status === 'connecting'}
                                aria-label={isActive ? 'Finalizar conversación' : 'Iniciar conversación'}
                                className={`vapi-mic-btn shadow-md !w-[60px] !h-[60px] z-10 ${isActive ? 'vapi-mic-btn-active' : 'vapi-mic-btn-inactive'}`}
                            >
                                {isActive ? (
                                    <PhoneOff className="size-7 text-white" />
                                ) : (
                                    <Play className="size-7 text-[#212a3b] ml-0.5" />
                                )}
                            </button>
                        </div>

                        <div className="vapi-mic-wrapper-left relative">
                            <button
                                type="button"
                                onClick={toggleMuted}
                                disabled={!isActive}
                                aria-label={isMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
                                className={`vapi-toggle-btn z-10 ${isMuted ? 'vapi-toggle-btn-on' : 'vapi-toggle-btn-off'}`}
                            >
                                {isMuted ? (
                                    <MicOff className="size-5 text-white" />
                                ) : (
                                    <Mic className="size-5 text-[#212a3b]" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold font-serif text-[#212a3b] mb-1 break-words">
                                    {book.title}
                                </h1>
                                <p className="text-[#3d485e] font-medium break-words">Por {book.author}</p>
                            </div>

                            <Link
                                href={`/history?bookId=${encodeURIComponent(book.id)}`}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#212a3b] shadow-sm transition-colors hover:bg-[#fff6e5]"
                            >
                                <History className="size-4" />
                                Ver historial
                            </Link>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="vapi-status-indicator">
                                <span className={`vapi-status-dot ${statusDisplay.color}`} />
                                <span className="vapi-status-text">{statusDisplay.label}</span>
                            </div>

                            <div className="vapi-status-indicator">
                                <span className="vapi-status-text">
                                    {formatDuration(duration)}/{formatDuration(maxDurationSeconds)}
                                </span>
                            </div>

                            <div className="relative" ref={requirementsRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowRequirements((prev) => !prev)}
                                    aria-expanded={showRequirements}
                                    aria-label="Requisitos antes de iniciar la conversación"
                                    className="flex size-6 items-center justify-center rounded-full text-[#8a7350] transition-colors hover:bg-[#fff6e5] hover:text-[#663820]"
                                >
                                    <HelpCircle className="size-5" aria-hidden="true" />
                                </button>

                                {showRequirements && (
                                    <div
                                        role="tooltip"
                                        className="absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-950 shadow-lg"
                                    >
                                        <p className="font-semibold">Antes de iniciar la conversación</p>
                                        <p className="mt-1">
                                            Necesitas conexión estable, micrófono y parlantes o
                                            audífonos activos. Si algún servicio externo de voz o
                                            IA falla, podrían presentarse demoras o una
                                            interrupción de la sesión.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            <div className="vapi-transcript-wrapper">
                <div className="transcript-container min-h-[400px]">
                    <Transcript
                        messages={messages}
                        currentMessage={currentMessage}
                        currentUserMessage={currentUserMessage}
                    />
                </div>
            </div>
            </div>
        </>
    )
}
export default VapiControls
