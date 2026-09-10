'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { deleteBook } from '@/lib/actions/book.actions';
import { BookCardProps } from '@/types';

const BookCard = ({ id, title, author, coverURL, slug }: BookCardProps) => {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);

    const handleDelete = async () => {
        const confirmed = window.confirm(
            `¿Eliminar “${title}”?\n\nTambién se eliminarán sus sesiones e historial. Esta acción no se puede deshacer.`,
        );

        if (!confirmed) return;

        setIsDeleting(true);

        try {
            const result = await deleteBook(id);

            if (!result.success) {
                toast.error(result.error || 'No se pudo eliminar la investigación.');
                return;
            }

            setIsDeleted(true);
            toast.success('Investigación eliminada.');
            router.refresh();
        } catch (error) {
            console.error('Error deleting book', error);
            toast.error('No se pudo eliminar la investigación.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (isDeleted) return null;

    return (
        <article className="book-card group relative">
            <Link href={`/books/${slug}`} className="block h-full rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#663820] focus-visible:ring-offset-2">
                <figure className="book-card-figure">
                    <div className="book-card-cover-wrapper">
                        <Image src={coverURL} alt={title} width={133} height={200} className="book-card-cover" unoptimized />
                    </div>

                    <figcaption className="book-card-meta">
                        <h3 className="book-card-title">{title}</h3>
                        <p className="book-card-author">{author}</p>
                    </figcaption>
                </figure>
            </Link>

            <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white text-red-600 opacity-100 shadow-md transition-all hover:scale-105 hover:bg-red-600 hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                aria-label={`Eliminar ${title}`}
                title={`Eliminar ${title}`}
            >
                {isDeleting ? (
                    <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                    <Trash2 className="size-5" aria-hidden="true" />
                )}
            </button>
        </article>
    );
};

export default BookCard
