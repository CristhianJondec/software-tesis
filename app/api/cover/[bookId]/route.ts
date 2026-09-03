import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/database/db';
import { books } from '@/database/schema';
import { getSession } from '@/lib/session';
import { getObjectStream } from '@/lib/r2';

export async function GET(_request: Request, { params }: { params: Promise<{ bookId: string }> }) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookId } = await params;

    const rows = await db
        .select({ coverBlobKey: books.coverBlobKey })
        .from(books)
        .where(and(eq(books.id, bookId), eq(books.userId, session.user.id)))
        .limit(1);

    if (rows.length === 0 || !rows[0].coverBlobKey) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
        const { body, contentType, contentLength } = await getObjectStream(rows[0].coverBlobKey);
        if (!body) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const headers = new Headers({
            'Content-Type': contentType ?? 'image/png',
            'Cache-Control': 'private, max-age=3600',
        });
        if (contentLength) headers.set('Content-Length', String(contentLength));

        return new Response(body, { headers });
    } catch (e) {
        console.error('Cover fetch error', e);
        return NextResponse.json({ error: 'Failed to fetch cover' }, { status: 500 });
    }
}
