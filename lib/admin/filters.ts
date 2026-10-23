import type { SurveyProgressStage } from '@/lib/surveys/progress';
import { normalizeStudyGroup } from '@/lib/study/groups';

/**
 * Filters of the participant list in /admin. They live in the URL
 * (?q=&grupo=&avance=) so a filtered view survives a reload and can be shared.
 */

export type GroupFilter = 'todos' | 'experimental' | 'control' | 'sin_asignar';
export type ProgressFilter = 'todos' | 'sin_respuestas' | 'o1_pendiente' | 'o2_pendiente' | 'completo';

export interface AdminFilters {
    q: string;
    grupo: GroupFilter;
    avance: ProgressFilter;
}

export const GROUP_FILTER_OPTIONS: readonly { value: GroupFilter; label: string }[] = [
    { value: 'todos', label: 'Todos los grupos' },
    { value: 'experimental', label: 'Experimental' },
    { value: 'control', label: 'Control' },
    { value: 'sin_asignar', label: 'Sin asignar' },
];

export const PROGRESS_FILTER_OPTIONS: readonly { value: ProgressFilter; label: string }[] = [
    { value: 'todos', label: 'Todo el avance' },
    { value: 'sin_respuestas', label: 'Sin respuestas' },
    { value: 'o1_pendiente', label: 'O₁ incompleto' },
    { value: 'o2_pendiente', label: 'O₁ completo, O₂ pendiente' },
    { value: 'completo', label: 'Flujo completo' },
];

function pick<T extends string>(value: unknown, options: readonly { value: T }[], fallback: T): T {
    return options.find((option) => option.value === value)?.value ?? fallback;
}

export function parseAdminFilters(params: Record<string, string | string[] | undefined>): AdminFilters {
    const first = (key: string) => {
        const value = params[key];
        return Array.isArray(value) ? value[0] : value;
    };
    return {
        q: (first('q') ?? '').trim(),
        grupo: pick(first('grupo'), GROUP_FILTER_OPTIONS, 'todos'),
        avance: pick(first('avance'), PROGRESS_FILTER_OPTIONS, 'todos'),
    };
}

export function hasActiveFilters(filters: AdminFilters): boolean {
    return filters.q !== '' || filters.grupo !== 'todos' || filters.avance !== 'todos';
}

interface FilterableUser {
    name: string;
    email: string;
    participantCode: string | null;
    studyGroup: string | null;
    stages: SurveyProgressStage[];
}

function phaseComplete(stages: SurveyProgressStage[], phase: 'T1' | 'T2'): boolean {
    return stages
        .filter((stage) => stage.phase === phase && stage.status !== 'not_applicable')
        .every((stage) => stage.status === 'completed');
}

function matchesProgress(stages: SurveyProgressStage[], filter: ProgressFilter): boolean {
    switch (filter) {
        case 'todos':
            return true;
        case 'sin_respuestas':
            return stages.every((stage) => stage.status !== 'completed');
        case 'o1_pendiente':
            return !phaseComplete(stages, 'T1');
        case 'o2_pendiente':
            return phaseComplete(stages, 'T1') && !phaseComplete(stages, 'T2');
        case 'completo':
            return stages
                .filter((stage) => stage.status !== 'not_applicable')
                .every((stage) => stage.status === 'completed');
    }
}

export function filterAdminUsers<T extends FilterableUser>(users: T[], filters: AdminFilters): T[] {
    const query = filters.q.toLowerCase();
    return users.filter((user) => {
        if (query) {
            const haystack = `${user.name} ${user.email} ${user.participantCode ?? ''}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        if (filters.grupo !== 'todos') {
            const group = normalizeStudyGroup(user.studyGroup) ?? 'sin_asignar';
            if (group !== filters.grupo) return false;
        }
        return matchesProgress(user.stages, filters.avance);
    });
}
