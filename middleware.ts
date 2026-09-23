import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export function middleware(req: NextRequest) {
    const sessionCookie = getSessionCookie(req);

    if (!sessionCookie) {
        const url = req.nextUrl.clone();
        url.pathname = '/sign-in';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

/**
 * Sign-in check only. The study-group gate does NOT live here: the edge
 * middleware can see the session cookie but not the database, and the group is
 * read from the database on purpose so a stale cookie can never widen access.
 * Each page and each server action carries its own guard (`lib/study/access`).
 */
export const config = {
    matcher: [
        '/books/:path*',
        '/history/:path*',
        '/surveys/:path*',
        '/admin/:path*',
        '/materiales/:path*',
        '/preparacion/:path*',
        '/progreso/:path*',
        '/metrics/:path*',
        '/sin-asignar',
    ],
};
