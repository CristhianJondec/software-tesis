'use client';

import { CircleHelp } from 'lucide-react';
import { Popover } from 'radix-ui';

import type { SurveyQuestionHelp as SurveyQuestionHelpContent } from '@/lib/surveys/catalog';

// Popover instead of Tooltip: tooltips only open on hover/focus, close on click and never open on touch.
export default function SurveyQuestionHelp({ term, explanation }: SurveyQuestionHelpContent) {
    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="ml-1 inline-flex size-6 align-middle items-center justify-center rounded-full text-[#663820] outline-none transition hover:bg-[#fff6e5] focus-visible:ring-2 focus-visible:ring-[#663820] focus-visible:ring-offset-2 data-[state=open]:bg-[#fff6e5]"
                    aria-label={`Ayuda sobre «${term}»`}
                >
                    <CircleHelp className="size-4.5" aria-hidden="true" />
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    side="top"
                    sideOffset={7}
                    collisionPadding={12}
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    className="z-[100] max-w-64 rounded-lg bg-[#212a3b] px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg outline-none"
                >
                    <strong className="font-semibold">{term}:</strong> {explanation}
                    <Popover.Arrow className="fill-[#212a3b]" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
