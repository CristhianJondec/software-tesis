import { z } from 'zod';
import {MAX_FILE_SIZE, ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE} from './constants';

export const UploadSchema = z.object({
    // Postgres `text` stores both values without an application-level character cap.
    title: z.string().trim().min(1, "El título es obligatorio"),
    author: z.string().trim().min(1, "El nombre del autor es obligatorio"),
    // Voice selection is temporarily hidden while the product uses one Vapi voice.
    // Make this required again when VoiceSelector returns to the creation form.
    persona: z.string(),
    pdfFile: z.instanceof(File, { message: "PDF file is required" })
        .refine((file) => file.size <= MAX_FILE_SIZE, "File size must be less than 50MB")
        .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), "Only PDF files are accepted"),
    coverImage: z.instanceof(File).optional()
        .refine((file) => !file || file.size <= MAX_IMAGE_SIZE, "Image size must be less than 10MB")
        .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Only .jpg, .jpeg, .png and .webp formats are supported"),
});
