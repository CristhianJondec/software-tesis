import type { SurveyProgressStage } from '@/lib/surveys/progress';
import { normalizeStudyGroup } from '@/lib/study/groups';

/**
 * Filters of the participant list in /admin. They live in the URL
 * (?q=&grupo=&avance=&pagina=) so a filtered view survives a reload and can be
 * shared. Changing a filter drops `pagina`, so the list goes back to page 1.
 */

export type GroupFilter = 'todos' | 'experimental' | 'control' | 'sin_asignar';
export type ProgressFilter = 'todos' | 'sin_respuestas' | 'o1_pendiente' | 'o2_pendiente' | 'completo';

export interface AdminFilters {
    q: string;
    grupo: GroupFilter;
    avance: ProgressFilter;
}

export const USERS_PAGE_SIZE = 20;

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

/** Page of the participant list requested in the URL (1-based). */
export function parseAdminPage(params: Record<string, string | string[] | undefined>): number {
    const raw = Array.isArray(params.pagina) ? params.pagina[0] : params.pagina;
    const page = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

export function serializeAdminFilters(filters: AdminFilters, page = 1): string {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.grupo !== 'todos') params.set('grupo', filters.grupo);
    if (filters.avance !== 'todos') params.set('avance', filters.avance);
    if (page > 1) params.set('pagina', String(page));
    return params.toString();
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
