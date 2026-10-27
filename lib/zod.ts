import { z } from 'zod';
import {MAX_FILE_SIZE, ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE} from './constants';

export const UploadSchema = z.object({
    // Postgres `text` stores both values without an application-level character cap.
    title: z.string().trim().min(1, "El título es obligatorio"),
    // Voice of the evaluating professor: a key of voiceOptions in lib/constants.ts.
    persona: z.string().min(1, "Selecciona una voz"),
    pdfFile: z.instanceof(File, { message: "Sube el PDF de tu investigación" })
        .refine((file) => file.size <= MAX_FILE_SIZE, "El archivo debe pesar menos de 50MB")
        .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), "Solo se aceptan archivos PDF"),
    coverImage: z.instanceof(File).optional()
        .refine((file) => !file || file.size <= MAX_IMAGE_SIZE, "La imagen debe pesar menos de 10MB")
        .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Solo se aceptan imágenes JPG, PNG o WEBP"),
});
