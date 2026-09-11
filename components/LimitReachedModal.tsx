import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { MAX_BOOKS_PER_USER } from '@/lib/constants';

const LimitReachedModal = () => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-100">
                    <AlertCircle className="size-7 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-[#212a3b] mb-2">
                    Alcanzaste tu límite de investigaciones
                </h2>
                <p className="text-[#3d485e] mb-6">
                    Puedes tener hasta {MAX_BOOKS_PER_USER} investigaciones a la vez. Elimina una
                    existente desde el inicio para poder subir una nueva.
                </p>
                <Link href="/" className="form-btn inline-flex items-center justify-center">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
};

export default LimitReachedModal;
