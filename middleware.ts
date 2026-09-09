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

export const config = {
    matcher: ['/books/:path*', '/history/:path*'],
};
