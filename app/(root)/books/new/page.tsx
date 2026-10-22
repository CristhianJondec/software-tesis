import UploadForm from "@/components/UploadForm";
import LimitReachedModal from "@/components/LimitReachedModal";
import UploadUnavailableModal from "@/components/UploadUnavailableModal";
import { getUserBookCount } from "@/lib/actions/book.actions";
import { MAX_BOOKS_PER_USER } from "@/lib/constants";
import { guardInterventionPage } from "@/lib/study/access";
import { getThesisUploadBlock, THESIS_UPLOAD_BLOCK_MESSAGES } from "@/lib/study/upload.server";

export const dynamic = 'force-dynamic';

const Page = async () => {
    const context = await guardInterventionPage();

    // Upload opens to the experimental arm only when the admin turns the flag on.
    const uploadBlock = await getThesisUploadBlock(context);

    const bookCount = await getUserBookCount();
    const limitReached = (bookCount.data ?? 0) >= MAX_BOOKS_PER_USER;

    return (
        <main className="new-book">
            <section className="flex flex-col gap-5 text-center">
                <h1 className="page-title-xl">Agregar una Nueva Investigación</h1>
                <p className="subtitle">Sube un PDF para generar tu experiencia de investigación interactiva</p>
            </section>

            {uploadBlock ? (
                <UploadUnavailableModal
                    message={THESIS_UPLOAD_BLOCK_MESSAGES[uploadBlock]}
                    showSurveysLink={uploadBlock === 'baseline'}
                />
            ) : limitReached ? (
                <LimitReachedModal />
            ) : (
                <UploadForm />
            )}
        </main>
    )
}

export default Page
