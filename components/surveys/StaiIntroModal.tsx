'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { STAI_SITUATION_INTRO } from '@/lib/surveys/catalog';

/**
 * Introductory modal shown every time a STAI stage opens (T1 and T2), before
 * the participant sees the scale. The text is the shared constant, so both
 * measurements are framed identically.
 */
export default function StaiIntroModal() {
    const [open, setOpen] = useState(true);
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="stai-intro-title"
                className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl"
            >
                <h2 id="stai-intro-title" className="mb-4 font-serif text-2xl font-bold text-[#212a3b]">
                    Antes de empezar
                </h2>
                <p className="mb-6 leading-7 text-[#3d485e]">{STAI_SITUATION_INTRO}</p>
                <Button
                    type="button"
                    size="lg"
                    autoFocus
                    onClick={() => setOpen(false)}
                    className="w-full bg-[#663820] hover:bg-[#7a4528]"
                >
                    Continuar
                </Button>
            </div>
        </div>
    );
}
