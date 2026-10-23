'use client';

import { useTransition } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { exportThesisWorkbook } from '@/lib/actions/thesis-export.actions';

export default function ExportThesisXlsxButton() {
    const [isPending, startTransition] = useTransition();

    const download = () => {
        startTransition(async () => {
            const result = await exportThesisWorkbook();
            if (!result.success || !result.data) {
                toast.error(result.error ?? 'No se pudo exportar el archivo.');
                return;
            }

            const bytes = Uint8Array.from(atob(result.data.base64), (char) => char.charCodeAt(0));
            const blob = new Blob([bytes], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
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
        <Button type="button" onClick={download} disabled={isPending} className="w-full bg-[#663820] hover:bg-[#7a4528] sm:w-auto">
            <FileSpreadsheet className="size-4" />
            {isPending ? 'Generando…' : 'Exportar datos de tesis'}
        </Button>
    );
}
