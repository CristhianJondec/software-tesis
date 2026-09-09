import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { notFound } from 'next/navigation';

import Transcript from '@/components/Transcript';
import { getConversationById } from '@/lib/actions/session.actions';
import { formatDuration } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
});

export default async function ConversationHistoryPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    const result = await getConversationById(sessionId);

    if (!result.success || !result.data) notFound();

    const { conversation, turns } = result.data;
    const messages = turns.map((turn) => ({ role: turn.role, content: turn.content }));

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-4xl">
                <Link
                    href="/history"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#3d485e] transition-colors hover:text-[#212a3b]"
                >
                    <ArrowLeft className="size-4" />
                    Volver al historial
                </Link>

                <div className="mb-5 rounded-2xl bg-[#f3e4c7] p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="font-serif text-2xl font-bold text-[#212a3b] break-words sm:text-3xl">
                                {conversation.bookTitle}
                            </h1>
                            <p className="mt-1 text-[#3d485e] break-words">Por {conversation.bookAuthor}</p>
                            <p className="mt-3 text-sm text-[#3d485e]">
                                {dateFormatter.format(conversation.startedAt)} · {formatDuration(conversation.durationSeconds)}
                            </p>
                        </div>

                        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#663820]">
                            <LockKeyhole className="size-4" />
                            Solo lectura
                        </div>
                    </div>
                </div>

                <div className="vapi-transcript-wrapper max-h-[70vh]">
                    <div className="transcript-container min-h-[420px] border border-[var(--border-subtle)]">
                        <Transcript messages={messages} currentMessage="" currentUserMessage="" />
                    </div>
                </div>
            </div>
        </main>
    );
}
