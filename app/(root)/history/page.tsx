import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, History, MessageCircle } from 'lucide-react';

import { getConversationHistory } from '@/lib/actions/session.actions';
import { formatDuration } from '@/lib/utils';

export const metadata = { title: 'Historial — Investfied' };

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
});

export default async function HistoryPage() {
    const result = await getConversationHistory();
    const conversations = result.success ? result.data ?? [] : [];

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-4xl">
                <div className="mb-8 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#f3e4c7]">
                        <History className="size-6 text-[#663820]" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-[#212a3b] sm:text-4xl">
                            Historial de conversaciones
                        </h1>
                        <p className="mt-2 text-[#3d485e]">
                            Revisa tus sesiones anteriores. Estas conversaciones son de solo lectura.
                        </p>
                    </div>
                </div>

                {!result.success && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {result.error}
                    </div>
                )}

                {result.success && conversations.length === 0 && (
                    <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                        <MessageCircle className="mx-auto size-10 text-[#8B7355]" />
                        <h2 className="mt-4 text-xl font-bold font-serif text-[#212a3b]">
                            Todavía no hay conversaciones
                        </h2>
                        <p className="mt-2 text-sm text-[#3d485e]">
                            Inicia una sesión desde alguna investigación y luego podrás revisarla aquí.
                        </p>
                        <Link href="/" className="btn-primary mt-6">Ir a la biblioteca</Link>
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    {conversations.map((conversation) => (
                        <Link
                            href={`/history/${conversation.id}`}
                            key={conversation.id}
                            className="group flex gap-4 rounded-2xl border border-[var(--border-subtle)] bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-5"
                        >
                            <Image
                                src={`/api/cover/${conversation.bookId}`}
                                alt=""
                                width={64}
                                height={88}
                                className="h-[88px] w-16 shrink-0 rounded-lg object-cover"
                                unoptimized
                            />

                            <div className="min-w-0 flex-1">
                                <h2 className="font-serif text-lg font-bold text-[#212a3b] break-words sm:text-xl">
                                    {conversation.bookTitle}
                                </h2>
                                <p className="mt-0.5 text-sm text-[#3d485e] break-words">
                                    Por {conversation.bookAuthor}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#3d485e] sm:text-sm">
                                    <span>{dateFormatter.format(conversation.startedAt)}</span>
                                    <span>{formatDuration(conversation.durationSeconds)}</span>
                                    <span>{Number(conversation.turnCount)} mensajes</span>
                                </div>
                            </div>

                            <ArrowRight className="mt-1 size-5 shrink-0 text-[#8B7355] transition-transform group-hover:translate-x-1" />
                        </Link>
                    ))}
                </div>
            </div>
        </main>
    );
}
