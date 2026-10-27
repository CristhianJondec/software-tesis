'use client';

import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

/**
 * "Ver respuestas" button of a participant row in /admin. Opens a side panel
 * with that participant's stages and raw survey answers, which the admin page
 * renders on the server and passes in as `children`.
 */
export default function UserDetailSheet({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-[#663820] shadow-sm transition-colors hover:bg-[#fff6e5]"
                >
                    <FileText className="size-3.5" /> Ver respuestas
                </button>
            </SheetTrigger>
            <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
                <SheetHeader className="border-b border-black/10 p-5 pr-12">
                    <SheetTitle className="font-serif text-xl font-bold">{title}</SheetTitle>
                    <SheetDescription className="break-words">{description}</SheetDescription>
                </SheetHeader>
                <div className="p-5">{children}</div>
            </SheetContent>
        </Sheet>
    );
}
