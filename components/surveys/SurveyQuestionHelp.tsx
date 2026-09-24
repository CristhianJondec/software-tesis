'use client';

import { CircleHelp } from 'lucide-react';
import { Tooltip } from 'radix-ui';

import type { SurveyQuestionHelp as SurveyQuestionHelpContent } from '@/lib/surveys/catalog';

export default function SurveyQuestionHelp({ term, explanation }: SurveyQuestionHelpContent) {
    return (
        <Tooltip.Root>
            <Tooltip.Trigger asChild>
                <button
                    type="button"
                    className="ml-1 inline-flex size-6 align-middle items-center justify-center rounded-full text-[#663820] outline-none transition hover:bg-[#fff6e5] focus-visible:ring-2 focus-visible:ring-[#663820] focus-visible:ring-offset-2"
                    aria-label={`Ayuda sobre «${term}»`}
                >
                    <CircleHelp className="size-4.5" aria-hidden="true" />
                </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
                <Tooltip.Content
                    side="top"
                    sideOffset={7}
                    collisionPadding={12}
                    className="z-[100] max-w-64 rounded-lg bg-[#212a3b] px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg"
                >
                    <strong className="font-semibold">{term}:</strong> {explanation}
                    <Tooltip.Arrow className="fill-[#212a3b]" />
                </Tooltip.Content>
            </Tooltip.Portal>
        </Tooltip.Root>
    );
}
