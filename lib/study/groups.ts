/**
 * The two participant roles of the experiment (docs/propuestas/07).
 *
 * `users.study_group` already existed as free text. This module is the single
 * place that gives those strings meaning, so the rule "what can a control
 * participant reach" lives in ONE decision point instead of scattered `if`s.
 *
 * Design of the control arm: a PASSIVE control. It reaches the research
 * instruments (`/surveys`) and a static preparation dossier (`/materiales`),
 * and nothing else — no voice agent, no RAG, no adaptive difficulty, no
 * progress views. That is what makes the experimental arm's effect attributable
 * to the agent rather than to "having some preparation material at all".
 */

export type StudyGroup = 'experimental' | 'control';

export const STUDY_GROUPS: readonly StudyGroup[] = ['experimental', 'control'];

export const STUDY_GROUP_LABELS: Record<StudyGroup, string> = {
    experimental: 'Experimental',
    control: 'Control',
};

/** Free-text column in, typed union out. Anything unrecognised counts as unassigned. */
export function normalizeStudyGroup(value: string | null | undefined): StudyGroup | null {
    const normalized = value?.trim().toLowerCase();
    return normalized === 'experimental' || normalized === 'control' ? normalized : null;
}

/**
 * Route prefixes a control participant may open. Everything else in the app
 * belongs to the intervention and is therefore experimental-only.
 */
export const CONTROL_ALLOWED_PREFIXES = ['/materiales', '/surveys'] as const;

export function isPathAllowedForControl(pathname: string): boolean {
    return CONTROL_ALLOWED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

/** Where each role lands after signing in. */
export function landingPathFor(group: StudyGroup | null): string {
    if (group === 'control') return '/materiales';
    if (group === 'experimental') return '/';
    return '/sin-asignar';
}
