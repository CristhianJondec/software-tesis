import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';

import { db } from '@/database/db';
import { users } from '@/database/schema';
import { configuredAdminEmail } from '@/lib/admin/access';
import { researchOwnerEmails } from '@/lib/metrics/access';
import { getSession } from '@/lib/session';
import { normalizeStudyGroup, type StudyGroup } from '@/lib/study/groups';

/**
 * Server-side gate for the two participant roles.
 *
 * Three states, and the third one matters: a brand new account has
 * `study_group = NULL` and is NOT a participant yet. It is blocked out of the
 * whole app until the researcher assigns it a group in /admin, so nobody
 * self-selects into an arm and no data is produced outside the protocol.
 *
 * Researchers (ADMIN_EMAIL, METRICS_OWNER_EMAILS) bypass the gate entirely —
 * otherwise the person who has to assign the groups would be locked out of the
 * panel where groups are assigned.
 */

export interface StudyContext {
    userId: string;
    email: string;
    group: StudyGroup | null;
    isResearcher: boolean;
    /** Researchers and the experimental arm. The control arm is false. */
    hasInterventionAccess: boolean;
    /** Researchers and the control arm. Experimental participants are false. */
    hasMaterialsAccess: boolean;
}

function isResearcherEmail(email: string): boolean {
    const admin = configuredAdminEmail();
    if (admin && admin === email) return true;
    return researchOwnerEmails().includes(email);
}

/** Null when nobody is signed in. Reads the group from the database, never from the cookie. */
export async function getStudyContext(): Promise<StudyContext | null> {
    const session = await getSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!session?.user || !email) return null;

    const rows = await db
        .select({ studyGroup: users.studyGroup })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1);

    const group = normalizeStudyGroup(rows[0]?.studyGroup);
    const isResearcher = isResearcherEmail(email);

    return {
        userId: session.user.id,
        email,
        group,
        isResearcher,
        hasInterventionAccess: isResearcher || group === 'experimental',
        hasMaterialsAccess: isResearcher || group === 'control',
    };
}

/**
 * Guard for pages of the intervention (library, upload, voice session, history,
 * preparation map, progress). Redirects instead of throwing: this runs while
 * rendering, and a participant landing on a forbidden URL should be moved to
 * the screen that IS theirs, not shown an error.
 */
export async function guardInterventionPage(): Promise<StudyContext> {
    const context = await getStudyContext();
    if (!context) redirect('/sign-in');
    if (context.hasInterventionAccess) return context;
    redirect(context.group === 'control' ? '/materiales' : '/sin-asignar');
}

/**
 * Same rule, but a signed-out visitor is left alone. Used by the landing page,
 * which stays a public marketing screen: only a signed-in participant of the
 * wrong arm is moved away from it.
 */
export async function redirectIfOutsideIntervention(): Promise<StudyContext | null> {
    const context = await getStudyContext();
    if (!context || context.hasInterventionAccess) return context;
    redirect(context.group === 'control' ? '/materiales' : '/sin-asignar');
}

/**
 * Guard for the screens both arms share (currently /surveys). Only the
 * unassigned are turned away.
 */
export async function guardParticipantPage(): Promise<StudyContext> {
    const context = await getStudyContext();
    if (!context) redirect('/sign-in');
    if (!context.group && !context.isResearcher) redirect('/sin-asignar');
    return context;
}

/** Guard for the control dossier. Experimental participants cannot open it. */
export async function guardMaterialsPage(): Promise<StudyContext> {
    const context = await getStudyContext();
    if (!context) redirect('/sign-in');
    if (context.hasMaterialsAccess) return context;
    redirect(context.group === 'experimental' ? '/' : '/sin-asignar');
}

/**
 * Guard for server actions of the intervention. Throws, because an action must
 * fail loudly rather than silently return an empty result the UI treats as
 * "no data".
 */
export async function requireInterventionAccess(): Promise<StudyContext> {
    const context = await getStudyContext();
    if (!context) throw new Error('Inicia sesión para continuar.');
    if (!context.hasInterventionAccess) {
        throw new Error(
            context.group === 'control'
                ? 'Tu cuenta pertenece al grupo control: no tiene acceso al agente de voz.'
                : 'Tu cuenta todavía no tiene un grupo asignado. Espera a que el investigador la habilite.',
        );
    }
    return context;
}
