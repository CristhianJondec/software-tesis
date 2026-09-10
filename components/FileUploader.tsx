'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useController, FieldValues } from 'react-hook-form';
import { ExternalLink, FileText, RefreshCw, X } from 'lucide-react';
import { FileUploadFieldProps } from '@/types';
import { cn } from '@/lib/utils';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

interface UploadedFilePreviewProps {
    file: File;
    disabled?: boolean;
    onReplace: (e: React.MouseEvent) => void;
    onRemove: (e: React.MouseEvent) => void;
}

const UploadedFilePreview = ({ file, disabled, onReplace, onRemove }: UploadedFilePreviewProps) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        const timeoutId = window.setTimeout(() => setPreviewUrl(objectUrl), 0);

        return () => {
            window.clearTimeout(timeoutId);
            URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    const openPreview = useCallback(() => {
        if (!previewUrl) return;

        const previewWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer');
        if (previewWindow) previewWindow.opener = null;
    }, [previewUrl]);

    return (
        <div className="overflow-hidden rounded-[6px] border-2 border-dashed border-[#8B7355]/20 bg-[#f3e4c7]">
            <button
                type="button"
                onClick={openPreview}
                disabled={!previewUrl || disabled}
                className="group relative block h-56 w-full cursor-pointer overflow-hidden bg-white disabled:cursor-not-allowed"
                aria-label={`Abrir vista previa de ${file.name} en otra pestaña`}
            >
                {isImage && previewUrl && (
                    // Blob URLs are local previews and cannot be optimized by next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={previewUrl}
                        alt={`Vista previa de ${file.name}`}
                        className="h-full w-full object-contain p-3"
                    />
                )}

                {isPdf && previewUrl && (
                    <iframe
                        src={`${previewUrl}#page=1&view=FitH&toolbar=0&navpanes=0`}
                        title={`Vista previa de ${file.name}`}
                        className="pointer-events-none h-full w-full border-0"
                        tabIndex={-1}
                    />
                )}

                {!isImage && !isPdf && (
                    <FileText className="mx-auto h-full w-16 text-[#8B7355]" />
                )}

                <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-[#212a3b]/90 px-3 py-2 text-sm font-medium text-white transition-colors group-hover:bg-[#3d485e]">
                    <ExternalLink className="h-4 w-4" />
                    Abrir vista previa en otra pestaña
                </span>
            </button>

            <div className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#663820]" title={file.name}>
                    {file.name}
                </p>
                <button
                    type="button"
                    onClick={onReplace}
                    disabled={disabled}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#663820] transition-colors hover:text-[#212a3b] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Cambiar ${file.name}`}
                >
                    <RefreshCw className="h-4 w-4" />
                    Cambiar
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={disabled}
                    className="upload-dropzone-remove disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Quitar ${file.name}`}
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

const FileUploader = <T extends FieldValues>({
    control,
    name,
    label,
    acceptTypes,
    disabled,
    icon: Icon,
    placeholder,
    hint,
}: FileUploadFieldProps<T>) => {
    const {
        field: { onChange, value },
    } = useController({ name, control });

    const inputRef = useRef<HTMLInputElement>(null);
    const selectedFile = value ? (value as File) : null;

    const handleFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                onChange(file);
            }
        },
        [onChange]
    );

    const onRemove = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onChange(null);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
        },
        [onChange]
    );

    const openFilePicker = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!disabled && inputRef.current) {
            inputRef.current.value = '';
            inputRef.current.click();
        }
    }, [disabled]);

    const isUploaded = !!selectedFile;

    return (
        <FormItem className="w-full">
            <FormLabel className="form-label">{label}</FormLabel>
            <FormControl>
                <div>
                    <input
                        type="file"
                        accept={acceptTypes.join(',')}
                        className="hidden"
                        ref={inputRef}
                        onChange={handleFileChange}
                        disabled={disabled}
                    />

                    {isUploaded ? (
                        <UploadedFilePreview
                            key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                            file={selectedFile}
                            disabled={disabled}
                            onReplace={openFilePicker}
                            onRemove={onRemove}
                        />
                    ) : (
                        <button
                            type="button"
                            className={cn(
                                'upload-dropzone w-full border-2 border-dashed border-[#8B7355]/20',
                                disabled && 'cursor-not-allowed opacity-60'
                            )}
                            onClick={openFilePicker}
                            disabled={disabled}
                        >
                            <Icon className="upload-dropzone-icon" />
                            <p className="upload-dropzone-text">{placeholder}</p>
                            <p className="upload-dropzone-hint">{hint}</p>
                        </button>
                    )}
                </div>
            </FormControl>
            <FormMessage />
        </FormItem>
    );
};

export default FileUploader;
