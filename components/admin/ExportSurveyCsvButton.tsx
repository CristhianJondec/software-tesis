'use client';

import { useTransition } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { exportSurveySummaryCsv } from '@/lib/actions/survey.actions';

export default function ExportSurveyCsvButton() {
    const [isPending, startTransition] = useTransition();

    const download = () => {
        startTransition(async () => {
            const result = await exportSurveySummaryCsv();
            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo exportar el archivo.');
                return;
            }

            const blob = new Blob([result.data.content], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = result.data.filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        });
    };

    return (
        <Button type="button" onClick={download} disabled={isPending} className="bg-[#663820] hover:bg-[#7a4528]">
            <Download className="size-4" />
            {isPending ? 'Preparando…' : 'Exportar resumen CSV'}
        </Button>
    );
}
