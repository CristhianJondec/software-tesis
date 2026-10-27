import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

/**
 * Shown on /books/new instead of the upload form once the account used every
 * upload it has (lib/study/uploads.ts), so the form cannot even be filled in.
 */
const LimitReachedModal = ({ limit }: { limit: number }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="limit-reached-title"
                className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl"
            >
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-100">
                    <AlertCircle className="size-7 text-amber-600" />
                </div>
                <h2 id="limit-reached-title" className="mb-2 text-xl font-bold text-[#212a3b]">
                    Alcanzaste tu límite de investigaciones
                </h2>
                <p className="mb-6 text-[#3d485e]">
                    {limit === 0
                        ? 'Tu cuenta no tiene subidas de investigación disponibles.'
                        : `Ya usaste ${limit === 1 ? 'tu subida disponible' : `tus ${limit} subidas disponibles`}.`}{' '}
                    Si necesitas subir o reemplazar tu documento, pídeselo al equipo de investigación.
                </p>
                <Link href="/" className="form-btn inline-flex items-center justify-center">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
};

export default LimitReachedModal;
