'use client';

import { useState, useTransition } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { exportMetricsCsv } from '@/lib/actions/metrics.actions';
import { CSV_BOM } from '@/lib/metrics/csv';

/**
 * Downloads the three CSV files.
 *
 * The action returns the files as text and the browser writes them, rather than
 * hitting a route handler: the project keeps data access in server actions. The
 * BOM is added here, at the moment the file is created, so it never travels
 * through the action payload.
 */
export default function ExportCsvButtons() {
    const [isPending, startTransition] = useTransition();
    const [lastExport, setLastExport] = useState<string | null>(null);

    const download = (filename: string, content: string) => {
        const blob = new Blob([CSV_BOM + content], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        startTransition(async () => {
            const result = await exportMetricsCsv();

            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo exportar.');
                return;
            }

            for (const file of result.data) {
                download(file.filename, file.content);
            }

            setLastExport(new Date().toISOString().slice(0, 19).replace('T', ' '));
            toast.success(`${result.data.length} archivos CSV descargados.`);
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <Button onClick={handleExport} disabled={isPending} className="w-fit">
                <Download className="icon-sm" />
                {isPending ? 'Preparando…' : 'Exportar CSV (turnos, sesiones, participantes)'}
            </Button>
            {lastExport && (
                <p className="text-xs text-[var(--text-secondary)]">Última exportación: {lastExport} UTC</p>
            )}
        </div>
    );
}
