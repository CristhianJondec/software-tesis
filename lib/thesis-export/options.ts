import { filterAdminUsers, type GroupFilter } from '@/lib/admin/filters';
import type { SurveyProgressStage } from '@/lib/surveys/progress';

/**
 * Options of the export modal in /admin, shared by the browser (to preview how
 * many participants go out) and the server actions (which re-validate them).
 *
 * Pure module: no database access.
 */

export type ExportFormat = 'xlsx' | 'csv';
export type ExportGroup = Exclude<GroupFilter, 'sin_asignar'>;

export interface ExportOptions {
    format: ExportFormat;
    /** Only accounts with a participant code: the researcher and test accounts have none. */
    onlyWithCode: boolean;
    group: ExportGroup;
    /** Only participants who finished every survey that applies to them. */
    onlyComplete: boolean;
    /** Drops the name and email columns; the participant code and internal id stay. */
    anonymize: boolean;
    /** .xlsx only: the `turnos` sheet with every transcript turn (the heaviest one). */
    includeTurns: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
    format: 'xlsx',
    onlyWithCode: true,
    group: 'todos',
    onlyComplete: false,
    anonymize: false,
    includeTurns: true,
};

export const EXPORT_GROUP_OPTIONS: readonly { value: ExportGroup; label: string }[] = [
    { value: 'todos', label: 'Todos los grupos' },
    { value: 'experimental', label: 'Solo experimental' },
    { value: 'control', label: 'Solo control' },
];

/** Options coming from the client, with every field checked; anything invalid falls back to the default. */
export function parseExportOptions(raw: unknown): ExportOptions {
    const value = (raw ?? {}) as Partial<Record<keyof ExportOptions, unknown>>;
    const flag = (key: 'onlyWithCode' | 'onlyComplete' | 'anonymize' | 'includeTurns') =>
        typeof value[key] === 'boolean' ? (value[key] as boolean) : DEFAULT_EXPORT_OPTIONS[key];
    return {
        format: value.format === 'csv' ? 'csv' : 'xlsx',
        onlyWithCode: flag('onlyWithCode'),
        group: EXPORT_GROUP_OPTIONS.find((option) => option.value === value.group)?.value ?? DEFAULT_EXPORT_OPTIONS.group,
        onlyComplete: flag('onlyComplete'),
        anonymize: flag('anonymize'),
        includeTurns: flag('includeTurns'),
    };
}

export interface ExportCandidate {
    name: string;
    email: string;
    participantCode: string | null;
    studyGroup: string | null;
    stages: SurveyProgressStage[];
}

/** The participants an export with these options contains (same rules as the /admin filters). */
export function selectExportUsers<T extends ExportCandidate>(users: T[], options: ExportOptions): T[] {
    const filtered = filterAdminUsers(users, {
        q: '',
        grupo: options.group,
        avance: options.onlyComplete ? 'completo' : 'todos',
    });
    return options.onlyWithCode ? filtered.filter((user) => Boolean(user.participantCode?.trim())) : filtered;
}
