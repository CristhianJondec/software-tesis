import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { getSession } from '@/lib/session';
import { presignPut } from '@/lib/r2';
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

const RequestSchema = z.object({
    scope: z.enum(['pdf', 'cover']),
    filename: z.string().min(1).max(200),
    contentType: z.string().min(1),
    size: z.number().int().positive(),
});

const slugFilename = (name: string) =>
    name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'file';

const extensionFromContentType = (ct: string) => {
    const map: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
    };
    return map[ct] ?? 'bin';
};

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const session = await getSession();
        const userId = session?.user?.id;
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const parsed = RequestSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }
        const { scope, filename, contentType, size } = parsed.data;

        const allowedTypes = scope === 'pdf' ? ACCEPTED_PDF_TYPES : ACCEPTED_IMAGE_TYPES;
        const maxSize = scope === 'pdf' ? MAX_FILE_SIZE : MAX_IMAGE_SIZE;

        if (!allowedTypes.includes(contentType)) {
            return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
        }
        if (size > maxSize) {
            return NextResponse.json({ error: 'File too large' }, { status: 400 });
        }

        const folder = scope === 'pdf' ? 'pdfs' : 'covers';
        const ext = extensionFromContentType(contentType);
        const key = `${folder}/${userId}/${nanoid()}-${slugFilename(filename)}.${ext}`;

        const uploadUrl = await presignPut(key, contentType, 600);

        return NextResponse.json({ uploadUrl, key });
    } catch (e) {
        console.error('Upload error', e);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
