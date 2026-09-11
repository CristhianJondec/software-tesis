'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload, ImageIcon } from 'lucide-react';
import { UploadSchema } from '@/lib/zod';
import { BookUploadFormValues } from '@/types';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES, MAX_BOOKS_PER_USER } from '@/lib/constants';
import FileUploader from './FileUploader';
// VoiceSelector is intentionally not imported while only the default Vapi voice is available.
// Restore the import and the commented form field below when multiple voices are enabled.
// import VoiceSelector from './VoiceSelector';
import LoadingOverlay from './LoadingOverlay';
import { useSession } from "@/lib/auth-client";
import { toast } from 'sonner';
import {checkBookExists, createBook, saveBookSegments} from "@/lib/actions/book.actions";
import {useRouter} from "next/navigation";
import {generateSlug, parsePDFFile} from "@/lib/utils";

type UploadScope = 'pdf' | 'cover';

async function uploadToR2(file: Blob & { name?: string }, scope: UploadScope, filename: string): Promise<string> {
    const presignRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            scope,
            filename,
            contentType: file.type,
            size: file.size,
        }),
    });

    if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get upload URL');
    }

    const { uploadUrl, key } = (await presignRes.json()) as { uploadUrl: string; key: string };

    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
    });

    if (!putRes.ok) {
        throw new Error(`Failed to upload to storage (${putRes.status})`);
    }

    return key;
}

const UploadForm = () => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { data: session } = useSession();
    const userId = session?.user?.id;
    const router = useRouter()

    const form = useForm<BookUploadFormValues>({
        resolver: zodResolver(UploadSchema),
        defaultValues: {
            title: '',
            author: '',
            persona: '',
            pdfFile: undefined,
            coverImage: undefined,
        },
    });

    const onSubmit = async (data: BookUploadFormValues) => {
        if(!userId) {
           return toast.error("Por favor inicia sesión para subir investigación");
        }

        setIsSubmitting(true);

        // PostHog -> Track Book Uploads...

        try {
            const existsCheck = await checkBookExists(data.title);

            if(existsCheck.exists && existsCheck.book) {
                toast.info("Ya existe una investigación con el mismo título.");
                form.reset()
                router.push(`/books/${existsCheck.book.slug}`)
                return;
            }

            // The persisted title has no character limit; storage keys stay short and filesystem-safe.
            const fileTitle = generateSlug(data.title);
            const pdfFile = data.pdfFile;

            const parsedPDF = await parsePDFFile(pdfFile);

            if(parsedPDF.content.length === 0) {
                toast.error("No se pudo procesar el PDF. Intenta con un archivo diferente.");
                return;
            }

            const pdfKey = await uploadToR2(pdfFile, 'pdf', `${fileTitle}.pdf`);

            let coverKey: string;

            if(data.coverImage) {
                const coverFile = data.coverImage;
                coverKey = await uploadToR2(coverFile, 'cover', `${fileTitle}-cover`);
            } else {
                const response = await fetch(parsedPDF.cover);
                const blob = await response.blob();
                const coverFile = new File([blob], `${fileTitle}-cover.png`, { type: 'image/png' });
                coverKey = await uploadToR2(coverFile, 'cover', `${fileTitle}-cover`);
            }

            const book = await createBook({
                title: data.title,
                author: data.author,
                persona: data.persona,
                fileURL: pdfKey,
                fileBlobKey: pdfKey,
                coverURL: coverKey,
                coverBlobKey: coverKey,
                fileSize: pdfFile.size,
            });

            if(!book.success) {
                if (book.error === 'limit_reached') {
                    toast.error(`Alcanzaste tu límite de ${MAX_BOOKS_PER_USER} investigaciones.`);
                } else {
                    toast.error(book.error as string || "Error al crear la investigación");
                }
                return;
            }

            if(book.alreadyExists) {
                toast.info("Ya existe una investigación con el mismo título.");
                form.reset()
                router.push(`/books/${book.data!.slug}`)
                return;
            }

            const segments = await saveBookSegments(book.data!.id, parsedPDF.content);

            if(!segments.success) {
                toast.error("Error al guardar los segmentos de la investigación");
                throw new Error("Failed to save book segments");
            }

            form.reset();
            router.push(`/books/${book.data!.slug}`);
        } catch (error) {
            console.error(error);

            toast.error("Error al subir la investigación. Inténtalo más tarde.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {isSubmitting && <LoadingOverlay />}

            <div className="new-book-wrapper">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        {/* 1. PDF File Upload */}
                        <FileUploader
                            control={form.control}
                            name="pdfFile"
                            label="Archivo PDF de la investigación"
                            acceptTypes={ACCEPTED_PDF_TYPES}
                            icon={Upload}
                            placeholder="Haz clic para subir el PDF"
                            hint="Archivo PDF (máx. 50MB)"
                            disabled={isSubmitting}
                        />

                        {/* 2. Cover Image Upload */}
                        <FileUploader
                            control={form.control}
                            name="coverImage"
                            label="Imagen de portada (opcional)"
                            acceptTypes={ACCEPTED_IMAGE_TYPES}
                            icon={ImageIcon}
                            placeholder="Haz clic para subir la imagen de portada"
                            hint="Déjalo vacío para generar automáticamente desde el PDF"
                            disabled={isSubmitting}
                        />

                        {/* 3. Title Input */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Título</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ej: Análisis del impacto digital en Latinoamérica"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 4. Author Input */}
                        <FormField
                            control={form.control}
                            name="author"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="form-label">Nombre del autor</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="form-input"
                                            placeholder="ej: Robert Kiyosaki"
                                            {...field}
                                            disabled={isSubmitting}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/*
                          Voice selection is intentionally hidden. Investfied currently uses
                          one default voice configured in Vapi. When multiple voices return,
                          restore the VoiceSelector import and its FormField here, then make
                          `persona` required again in UploadSchema.
                        */}

                        {/* 5. Submit Button */}
                        <Button type="submit" className="form-btn" disabled={isSubmitting}>
                            Iniciar síntesis
                        </Button>
                    </form>
                </Form>
            </div>
        </>
    );
};

export default UploadForm;
