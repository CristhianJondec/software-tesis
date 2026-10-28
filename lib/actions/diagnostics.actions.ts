'use server';

import { requireAdmin } from '@/lib/admin/access';
import { canRevealEnvVar } from '@/lib/diagnostics/env.server';
import { writeSystemLog } from '@/lib/system-logs/write.server';

/**
 * Returns the value of one environment variable to the admin, on demand, from
 * /admin/diagnostico. Every reveal is written to the system log, so a leaked
 * key can be traced to the moment it was shown.
 */
export const revealEnvVar = async (name: string): Promise<{ success: boolean; value?: string; error?: string }> => {
    try {
        const admin = await requireAdmin();
        if (!canRevealEnvVar(name)) {
            return { success: false, error: 'Esta variable no se puede mostrar.' };
        }

        const value = process.env[name];
        if (value === undefined) return { success: false, error: 'La variable no está definida en este deploy.' };

        await writeSystemLog({
            level: 'warn',
            source: 'server',
            event: 'admin.env_revealed',
            message: `El admin mostró el valor de ${name}.`,
            userId: admin.userId,
            metadata: { name },
        });
        return { success: true, value };
    } catch (error) {
        console.error('Error revealing environment variable', error);
        return { success: false, error: 'No se pudo leer la variable.' };
    }
};
