import { redirect } from 'next/navigation';
import { Hourglass } from 'lucide-react';

import { getStudyContext } from '@/lib/study/access';
import { landingPathFor } from '@/lib/study/groups';

export const metadata = { title: 'Cuenta pendiente — Investfied' };
export const dynamic = 'force-dynamic';

/**
 * Holding screen for an account the researcher has not admitted into the study
 * yet. It deliberately says nothing about the two arms: a participant must not
 * learn that groups exist, let alone which one they will land in.
 */
export default async function UnassignedPage() {
    const context = await getStudyContext();
    if (!context) redirect('/sign-in');
    if (context.group || context.isResearcher) redirect(landingPathFor(context.group));

    return (
        <main className="wrapper container">
            <div className="mx-auto max-w-2xl rounded-2xl border border-black/10 bg-white p-10 text-center shadow-sm">
                <Hourglass className="mx-auto mb-5 size-10 text-[#663820]" />
                <h1 className="page-title-xl">Tu cuenta está en revisión</h1>
                <p className="subtitle mt-5">
                    El responsable de la investigación todavía no ha habilitado tu participación. En cuanto lo haga,
                    podrás acceder desde este mismo inicio de sesión.
                </p>
                <p className="mt-6 text-sm text-[var(--text-secondary)]">
                    Si crees que esto es un error, comunícate con el responsable del estudio indicando el correo con el
                    que te registraste: <strong>{context.email}</strong>
                </p>
            </div>
        </main>
    );
}
