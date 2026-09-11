import UploadForm from "@/components/UploadForm";
import LimitReachedModal from "@/components/LimitReachedModal";
import { getUserBookCount } from "@/lib/actions/book.actions";
import { MAX_BOOKS_PER_USER } from "@/lib/constants";

const Page = async () => {
    const bookCount = await getUserBookCount();
    const limitReached = (bookCount.data ?? 0) >= MAX_BOOKS_PER_USER;

    return (
        <main className="new-book">
            <section className="flex flex-col gap-5 text-center">
                <h1 className="page-title-xl">Agregar una Nueva Investigación</h1>
                <p className="subtitle">Sube un PDF para generar tu experiencia de investigación interactiva</p>
            </section>

            {limitReached ? <LimitReachedModal /> : <UploadForm />}
        </main>
    )
}

export default Page
