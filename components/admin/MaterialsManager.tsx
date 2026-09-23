'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createStudyMaterial, deleteStudyMaterial, type StudyMaterialRow } from '@/lib/actions/material.actions';
import { ACCEPTED_PDF_TYPES, MAX_FILE_SIZE } from '@/lib/constants';

function formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Uploads the shared dossier PDFs shown on /materiales to both study arms. */
export default function MaterialsManager({ materials }: { materials: StudyMaterialRow[] }) {
    const router = useRouter();
    const fileInput = useRef<HTMLInputElement>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();

        const file = fileInput.current?.files?.[0];
        if (!file) return toast.error('Elige un archivo PDF.');
        if (!ACCEPTED_PDF_TYPES.includes(file.type)) return toast.error('El archivo debe ser un PDF.');
        if (file.size > MAX_FILE_SIZE) return toast.error('El archivo supera el tamaño máximo permitido.');
        if (!title.trim()) return toast.error('Escribe un título para el material.');

        setIsUploading(true);
        try {
            const presignResponse = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scope: 'material',
                    filename: file.name,
                    contentType: file.type,
                    size: file.size,
                }),
            });

            if (!presignResponse.ok) {
                const body = await presignResponse.json().catch(() => ({}));
                throw new Error(body.error || 'No se pudo preparar la subida.');
            }

            const { uploadUrl, key } = (await presignResponse.json()) as { uploadUrl: string; key: string };

            const putResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type },
                body: file,
            });
            if (!putResponse.ok) throw new Error(`Falló la subida del archivo (${putResponse.status}).`);

            const result = await createStudyMaterial({
                title: title.trim(),
                description: description.trim() || undefined,
                fileName: file.name,
                fileBlobKey: key,
                fileSize: file.size,
            });
            if (!result.success) throw new Error(result.error ?? 'No se pudo guardar el material.');

            toast.success('Material publicado.');
            setTitle('');
            setDescription('');
            if (fileInput.current) fileInput.current.value = '';
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo subir el material.');
        } finally {
            setIsUploading(false);
        }
    };

    const remove = (material: StudyMaterialRow) => {
        if (!window.confirm(`¿Eliminar "${material.title}"? El archivo se borra del almacenamiento y no se puede recuperar.`)) {
            return;
        }

        startTransition(async () => {
            const result = await deleteStudyMaterial(material.id);
            if (!result.success) {
                toast.error(result.error ?? 'No se pudo eliminar el material.');
                return;
            }
            toast.success('Material eliminado.');
            router.refresh();
        });
    };

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
            <form onSubmit={submit} className="grid h-fit gap-4 rounded-xl border border-black/10 bg-white p-5 shadow-sm">
                <div className="grid gap-2">
                    <Label htmlFor="material-title">Título</Label>
                    <Input
                        id="material-title"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Guía de sustentación de avance"
                        disabled={isUploading}
                        required
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="material-description">Descripción (opcional)</Label>
                    <Input
                        id="material-description"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Qué contiene y para qué sirve"
                        disabled={isUploading}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="material-file">Archivo PDF</Label>
                    <Input id="material-file" ref={fileInput} type="file" accept="application/pdf" disabled={isUploading} required />
                </div>
                <Button type="submit" disabled={isUploading} className="bg-[#663820] hover:bg-[#7a4528]">
                    <Upload className="size-4" />
                    {isUploading ? 'Subiendo…' : 'Publicar material'}
                </Button>
                <p className="text-xs text-[var(--text-secondary)]">
                    Lo ven todos los participantes de ambos grupos en la vista Materiales.
                </p>
            </form>

            <div className="rounded-xl border border-black/10 bg-white shadow-sm">
                {materials.length === 0 ? (
                    <p className="p-8 text-center text-sm text-[var(--text-secondary)]">
                        Aún no hay documentos publicados. La guía escrita se muestra igualmente.
                    </p>
                ) : (
                    <ul className="divide-y divide-black/5">
                        {materials.map((material) => (
                            <li key={material.id} className="flex items-start gap-4 p-4">
                                <span className="mt-0.5 rounded-lg bg-[#fff6e5] p-2 text-[#663820]">
                                    <FileText className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <a
                                        href={`/api/materials/${material.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-semibold text-[#212a3b] hover:underline"
                                    >
                                        {material.title}
                                    </a>
                                    {material.description && (
                                        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{material.description}</p>
                                    )}
                                    <p className="mt-1 truncate text-xs text-[var(--text-secondary)]">
                                        {material.fileName} · {formatSize(material.fileSize)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => remove(material)}
                                    className="shrink-0 text-red-700 hover:text-red-800"
                                >
                                    <Trash2 className="size-4" />
                                    Eliminar
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
