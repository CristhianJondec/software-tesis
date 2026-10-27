'use client';

import { useMemo, useState, useTransition } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { exportSurveySummaryCsv } from '@/lib/actions/survey.actions';
import { exportThesisWorkbook } from '@/lib/actions/thesis-export.actions';
import {
    DEFAULT_EXPORT_OPTIONS,
    EXPORT_GROUP_OPTIONS,
    selectExportUsers,
    type ExportCandidate,
    type ExportFormat,
    type ExportOptions,
} from '@/lib/thesis-export/options';
import { cn } from '@/lib/utils';

const FORMATS: readonly { value: ExportFormat; title: string; description: string; icon: typeof FileText }[] = [
    {
        value: 'xlsx',
        title: 'Datos de tesis (.xlsx)',
        description: 'O₁/O₂, SUS, uso, sesiones, métricas, turnos y diccionario de columnas.',
        icon: FileSpreadsheet,
    },
    {
        value: 'csv',
        title: 'Resumen de encuestas (.csv)',
        description: 'Una fila por participante con AE, AC, SUS y la fecha de cada encuesta.',
        icon: FileText,
    },
];

function saveFile(content: BlobPart, type: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function Toggle({
    checked,
    onChange,
    label,
    hint,
    disabled,
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    hint: string;
    disabled?: boolean;
}) {
    return (
        <label
            className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 p-3',
                disabled && 'cursor-not-allowed opacity-50',
            )}
        >
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[#663820]"
            />
            <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-[var(--text-secondary)]">{hint}</span>
            </span>
        </label>
    );
}

/**
 * "Exportar" button of /admin: a modal to pick the file and which participants
 * go in it. The count is previewed here with the same rule the server applies
 * (lib/thesis-export/options.ts), and the server re-validates the options.
 */
export default function ExportDialog({ participants }: { participants: ExportCandidate[] }) {
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS);
    const [isPending, startTransition] = useTransition();

    const selectedCount = useMemo(() => selectExportUsers(participants, options).length, [participants, options]);
    const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) =>
        setOptions((current) => ({ ...current, [key]: value }));

    const download = () => {
        startTransition(async () => {
            if (options.format === 'xlsx') {
                const result = await exportThesisWorkbook(options);
                if (!result.success || !result.data) {
                    toast.error(result.error ?? 'No se pudo exportar el archivo.');
                    return;
                }
                const bytes = Uint8Array.from(atob(result.data.base64), (char) => char.charCodeAt(0));
                saveFile(bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', result.data.filename);
            } else {
                const result = await exportSurveySummaryCsv(options);
                if (!result.success || !result.data) {
                    toast.error(result.error ?? 'No se pudo exportar el archivo.');
                    return;
                }
                saveFile(result.data.content, 'text/csv;charset=utf-8', result.data.filename);
            }
            toast.success(`Exportados ${selectedCount} ${selectedCount === 1 ? 'participante' : 'participantes'}.`);
            setOpen(false);
        });
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !isPending && setOpen(next)}>
            <DialogTrigger asChild>
                <Button type="button" className="w-full bg-[#663820] hover:bg-[#7a4528] sm:w-auto">
                    <Download className="size-4" /> Exportar
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="font-serif text-xl font-bold">Exportar datos</DialogTitle>
                    <DialogDescription>Elige el archivo y qué participantes incluir.</DialogDescription>
                </DialogHeader>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-semibold">Archivo</legend>
                    {FORMATS.map((format) => {
                        const Icon = format.icon;
                        const selected = options.format === format.value;
                        return (
                            <label
                                key={format.value}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#663820]/40',
                                    selected ? 'border-[#663820] bg-[#fff6e5]' : 'border-black/10 hover:bg-[#fffaf0]',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="export-format"
                                    value={format.value}
                                    checked={selected}
                                    onChange={() => set('format', format.value)}
                                    className="sr-only"
                                />
                                <Icon className="mt-0.5 size-5 shrink-0 text-[#663820]" />
                                <span className="grid gap-0.5">
                                    <span className="text-sm font-semibold">{format.title}</span>
                                    <span className="text-xs text-[var(--text-secondary)]">{format.description}</span>
                                </span>
                            </label>
                        );
                    })}
                </fieldset>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-semibold">Participantes</legend>
                    <Toggle
                        checked={options.onlyWithCode}
                        onChange={(value) => set('onlyWithCode', value)}
                        label="Solo los que tienen código de participante"
                        hint="Deja fuera tu cuenta y las de prueba, que no tienen código."
                    />
                    <Toggle
                        checked={options.onlyComplete}
                        onChange={(value) => set('onlyComplete', value)}
                        label="Solo con el flujo completo"
                        hint="Respondieron todas las encuestas que les corresponden (O₁, O₂ y SUS si aplica)."
                    />
                    <label className="grid gap-1 text-sm">
                        <span className="font-semibold">Grupo</span>
                        <select
                            value={options.group}
                            onChange={(event) => set('group', event.target.value as ExportOptions['group'])}
                            className="rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
                        >
                            {EXPORT_GROUP_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                </fieldset>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-semibold">Contenido</legend>
                    <Toggle
                        checked={options.anonymize}
                        onChange={(value) => set('anonymize', value)}
                        label="Anonimizar"
                        hint="Quita las columnas de nombre y correo. Quedan el código y el identificador interno."
                    />
                    <Toggle
                        checked={options.includeTurns}
                        onChange={(value) => set('includeTurns', value)}
                        disabled={options.format !== 'xlsx'}
                        label="Incluir las transcripciones (hoja «turnos»)"
                        hint="Cada turno con su texto. Es la hoja más pesada; desactívala si solo necesitas puntajes."
                    />
                </fieldset>

                <DialogFooter className="items-center gap-3 sm:justify-between">
                    <p
                        className={cn(
                            'text-sm',
                            selectedCount === 0 ? 'font-semibold text-red-700' : 'text-[var(--text-secondary)]',
                        )}
                    >
                        {selectedCount === 0
                            ? 'Ningún participante cumple estas opciones.'
                            : `Se exportarán ${selectedCount} de ${participants.length} participantes.`}
                    </p>
                    <Button
                        type="button"
                        onClick={download}
                        disabled={isPending || selectedCount === 0}
                        className="w-full bg-[#663820] hover:bg-[#7a4528] sm:w-auto"
                    >
                        <Download className="size-4" />
                        {isPending ? 'Generando…' : 'Descargar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
