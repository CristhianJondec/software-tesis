import Link from 'next/link';
import { Clock3 } from 'lucide-react';

/** Shown on /books/new while thesis upload is closed for this participant. */
const UploadUnavailableModal = ({ message, showSurveysLink }: { message: string; showSurveysLink: boolean }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="upload-unavailable-title"
                className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl"
            >
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-100">
                    <Clock3 className="size-7 text-amber-600" />
                </div>
                <h2 id="upload-unavailable-title" className="mb-2 text-xl font-bold text-[#212a3b]">
                    Subida de investigación no disponible
                </h2>
                <p className="mb-6 text-[#3d485e]">{message}</p>
                <Link
                    href={showSurveysLink ? '/surveys' : '/'}
                    className="form-btn inline-flex items-center justify-center"
                >
                    {showSurveysLink ? 'Ir a las encuestas' : 'Volver al inicio'}
                </Link>
            </div>
        </div>
    );
};

export default UploadUnavailableModal;
