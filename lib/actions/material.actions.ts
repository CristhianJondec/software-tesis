'use server';

import { asc, desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

import { db } from '@/database/db';
import { studyMaterials } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { deleteObjects } from '@/lib/r2';
import { getStudyContext } from '@/lib/study/access';

export interface StudyMaterialRow {
    id: string;
    title: string;
    description: string | null;
    fileName: string;
    fileSize: number;
    sortOrder: number;
    createdAt: string;
}

async function readMaterials(): Promise<StudyMaterialRow[]> {
    const rows = await db
        .select({
            id: studyMaterials.id,
            title: studyMaterials.title,
            description: studyMaterials.description,
            fileName: studyMaterials.fileName,
            fileSize: studyMaterials.fileSize,
            sortOrder: studyMaterials.sortOrder,
            createdAt: studyMaterials.createdAt,
        })
        .from(studyMaterials)
        .orderBy(asc(studyMaterials.sortOrder), asc(studyMaterials.createdAt));

    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/**
 * The shared dossier, readable by any assigned participant of either arm.
 * Not ownership-scoped: it is one set of documents for the whole study.
 */
export const listStudyMaterials = async (): Promise<{
    success: boolean;
    data?: StudyMaterialRow[];
    error?: string;
}> => {
    try {
        const context = await getStudyContext();
        if (!context) return { success: false, error: 'Inicia sesión para ver los materiales.' };
        if (!context.group && !context.isResearcher) {
            return { success: false, error: 'Tu cuenta todavía no tiene un grupo asignado.' };
        }

        return { success: true, data: await readMaterials() };
    } catch (error) {
        console.error('Error listing study materials', error);
        return { success: false, error: 'No se pudieron cargar los materiales.' };
    }
};

export const listStudyMaterialsForAdmin = async (): Promise<{
    success: boolean;
    data?: StudyMaterialRow[];
    error?: string;
}> => {
    try {
        await requireAdmin();
        return { success: true, data: await readMaterials() };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'No se pudieron cargar los materiales.' };
    }
};

export interface CreateStudyMaterialInput {
    title: string;
    description?: string;
    fileName: string;
    /** R2 key returned by /api/upload with scope 'material'. */
    fileBlobKey: string;
    fileSize: number;
}

export const createStudyMaterial = async (
    input: CreateStudyMaterialInput,
): Promise<{ success: boolean; error?: string }> => {
    try {
        const admin = await requireAdmin();

        const title = input?.title?.trim();
        const fileBlobKey = input?.fileBlobKey?.trim();
        if (!title) return { success: false, error: 'El material necesita un título.' };
        if (!fileBlobKey.startsWith('materials/')) {
            return { success: false, error: 'El archivo no se subió correctamente.' };
        }
        if (!Number.isInteger(input.fileSize) || input.fileSize <= 0) {
            return { success: false, error: 'El archivo no se subió correctamente.' };
        }

        // New materials go to the end of the list.
        const [last] = await db
            .select({ sortOrder: studyMaterials.sortOrder })
            .from(studyMaterials)
            .orderBy(desc(studyMaterials.sortOrder))
            .limit(1);
        const highest = last?.sortOrder ?? -1;

        await db.insert(studyMaterials).values({
            id: nanoid(),
            title,
            description: input.description?.trim() || null,
            fileName: input.fileName.trim() || 'material.pdf',
            fileBlobKey,
            fileSize: input.fileSize,
            sortOrder: highest + 1,
            uploadedBy: admin.userId,
        });

        revalidatePath('/materiales');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error creating study material', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo guardar el material.' };
    }
};

export const deleteStudyMaterial = async (materialId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireAdmin();

        const rows = await db
            .select({ fileBlobKey: studyMaterials.fileBlobKey })
            .from(studyMaterials)
            .where(eq(studyMaterials.id, materialId))
            .limit(1);

        if (rows.length === 0) return { success: false, error: 'El material no existe.' };

        await db.delete(studyMaterials).where(eq(studyMaterials.id, materialId));
        await deleteObjects([rows[0].fileBlobKey]);

        revalidatePath('/materiales');
        revalidatePath('/admin');
        return { success: true };
    } catch (error) {
        console.error('Error deleting study material', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo eliminar el material.' };
    }
};
