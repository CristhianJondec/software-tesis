import UploadForm from "@/components/UploadForm";

const Page = () => {
    return (
        <main className="new-book">
            <section className="flex flex-col gap-5 text-center">
                <h1 className="page-title-xl">Agregar una Nueva Tesis</h1>
                <p className="subtitle">Sube un PDF para generar tu experiencia de investigación interactiva</p>
            </section>

            <UploadForm />
        </main>
    )
}

export default Page
