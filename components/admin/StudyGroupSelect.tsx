'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { setParticipantStudyGroup } from '@/lib/actions/study.actions';
import { STUDY_GROUPS, STUDY_GROUP_LABELS, type StudyGroup } from '@/lib/study/groups';

/**
 * Assigns a participant to an arm. Lives only in the admin panel: the protocol
 * forbids the participant from knowing — or choosing — their own group.
 */
export default function StudyGroupSelect({
    userId,
    value,
    participantLabel,
}: {
    userId: string;
    value: StudyGroup | null;
    participantLabel: string;
}) {
    const [current, setCurrent] = useState<StudyGroup | ''>(value ?? '');
    const [isPending, startTransition] = useTransition();

    const change = (next: string) => {
        const previous = current;
        setCurrent(next as StudyGroup | '');

        startTransition(async () => {
            const result = await setParticipantStudyGroup(userId, next);
            if (!result.success) {
                setCurrent(previous);
                toast.error(result.error ?? 'No se pudo asignar el grupo.');
                return;
            }
            toast.success(
                next
                    ? `${participantLabel}: grupo ${STUDY_GROUP_LABELS[next as StudyGroup].toLowerCase()}.`
                    : `${participantLabel}: acceso retirado hasta una nueva asignación.`,
            );
        });
    };

    return (
        <select
            value={current}
            disabled={isPending}
            onChange={(event) => change(event.target.value)}
            aria-label={`Grupo de estudio de ${participantLabel}`}
            className="w-full rounded-lg border border-black/15 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
        >
            <option value="">Sin asignar</option>
            {STUDY_GROUPS.map((group) => (
                <option key={group} value={group}>
                    {STUDY_GROUP_LABELS[group]}
                </option>
            ))}
        </select>
    );
}
