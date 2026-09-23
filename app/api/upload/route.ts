import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { checkAdminAccess } from '@/lib/admin/access';
import { getSession } from '@/lib/session';
import { presignPut } from '@/lib/r2';
import { MAX_FILE_SIZE, MAX_IMAGE_SIZE, ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES } from '@/lib/constants';

const RequestSchema = z.object({
    scope: z.enum(['pdf', 'cover', 'material']),
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

        // The shared study dossier is researcher-owned content, not participant
        // content, so it needs the admin allowlist and not just a session.
        if (scope === 'material') {
            const access = await checkAdminAccess();
            if (!access.allowed) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const allowedTypes = scope === 'cover' ? ACCEPTED_IMAGE_TYPES : ACCEPTED_PDF_TYPES;
        const maxSize = scope === 'cover' ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

        if (!allowedTypes.includes(contentType)) {
            return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
        }
        if (size > maxSize) {
            return NextResponse.json({ error: 'File too large' }, { status: 400 });
        }

        const folder = scope === 'pdf' ? 'pdfs' : scope === 'cover' ? 'covers' : 'materials';
        const ext = extensionFromContentType(contentType);
        // Dossier files are shared, so they are not filed under a participant id.
        const prefix = scope === 'material' ? folder : `${folder}/${userId}`;
        const key = `${prefix}/${nanoid()}-${slugFilename(filename)}.${ext}`;

        const uploadUrl = await presignPut(key, contentType, 600);

        return NextResponse.json({ uploadUrl, key });
    } catch (e) {
        console.error('Upload error', e);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
