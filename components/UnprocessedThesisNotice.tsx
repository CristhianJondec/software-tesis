'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { deleteBook } from '@/lib/actions/book.actions';

/**
 * Shown on a thesis page instead of the voice controls when the thesis has no
 * segments (its processing never finished): a session with it would leave the
 * agent with nothing to retrieve. A failed upload never used the student's
 * upload slot (lib/study/uploads.ts), so deleting it and uploading again is free.
 */
export default function UnprocessedThesisNotice({ bookId, title }: { bookId: string; title: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const deleteAndReupload = () => {
        startTransition(async () => {
            const result = await deleteBook(bookId);
            if (!result.success) {
                toast.error(result.error ?? 'No se pudo eliminar la investigación.');
                return;
            }
            router.push('/books/new');
        });
    };

    return (
        <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-xl" role="alert">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="size-7 text-amber-600" />
            </div>
            <h1 className="mb-2 text-xl font-bold text-[#212a3b]">Tu investigación no terminó de procesarse</h1>
            <p className="mb-2 text-[#3d485e]">
                «{title}» se subió, pero no se pudo analizar su contenido. Sin eso, el jurado virtual no puede hacerte
                preguntas sobre tu documento.
            </p>
            <p className="mb-6 text-[#3d485e]">
                Elimínala y vuelve a subir el PDF. No pierdes tu cupo de subida.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <button
                    type="button"
                    onClick={deleteAndReupload}
                    disabled={isPending}
                    className="form-btn inline-flex items-center justify-center disabled:opacity-60"
                >
                    {isPending ? 'Eliminando…' : 'Eliminar y volver a subir'}
                </button>
                <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-black/15 px-4 py-2 font-semibold text-[#3d485e]">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
