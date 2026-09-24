import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/database/db';
import { studyMaterials } from '@/database/schema';
import { getObjectStream } from '@/lib/r2';
import { getStudyContext } from '@/lib/study/access';

/**
 * Serves a dossier PDF from R2.
 *
 * Unlike /api/cover, this is not ownership-scoped — the dossier is shared by the
 * control group — but it still requires control/researcher access, so the bucket
 * key is never reachable by an experimental or unassigned participant.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ materialId: string }> }) {
    const context = await getStudyContext();
    if (!context) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!context.hasMaterialsAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { materialId } = await params;

    const rows = await db
        .select({ fileBlobKey: studyMaterials.fileBlobKey, fileName: studyMaterials.fileName })
        .from(studyMaterials)
        .where(eq(studyMaterials.id, materialId))
        .limit(1);

    if (rows.length === 0) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        const { body, contentType, contentLength } = await getObjectStream(rows[0].fileBlobKey);
        if (!body) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const headers = new Headers({
            'Content-Type': contentType ?? 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(rows[0].fileName)}"`,
            'Cache-Control': 'private, max-age=3600',
        });
        if (contentLength) headers.set('Content-Length', String(contentLength));

        return new Response(body, { headers });
    } catch (e) {
        console.error('Material fetch error', e);
        return NextResponse.json({ error: 'Failed to fetch material' }, { status: 500 });
    }
}
