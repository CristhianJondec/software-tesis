import { ReactNode } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { LucideIcon } from 'lucide-react';
import type { InferSelectModel } from 'drizzle-orm';
import z from 'zod';
import { UploadSchema } from '@/lib/zod';
import { books, bookSegments, sessionTurns, turnRetrievals, voiceSessions } from '@/database/schema';
import type { PlanType } from '@/lib/subscription-constants';

// ============================================
// DATABASE MODELS (inferred from Drizzle schema)
// ============================================

export type IBook = InferSelectModel<typeof books>;
export type IBookSegment = InferSelectModel<typeof bookSegments>;
export type IVoiceSession = InferSelectModel<typeof voiceSessions>;
export type ISessionTurn = InferSelectModel<typeof sessionTurns>;
export type ITurnRetrieval = InferSelectModel<typeof turnRetrievals>;

// ============================================
// FORM & INPUT TYPES
// ============================================

export type BookUploadFormValues = z.infer<typeof UploadSchema>;

export interface CreateBook {
    title: string;
    author: string;
    persona?: string;
    fileURL: string;
    fileBlobKey: string;
    coverURL?: string;
    coverBlobKey?: string;
    fileSize: number;
}

/** One page of a parsed PDF, before segmentation. */
export interface PdfPage {
    /** 1-based, as shown to the reader. */
    pageNumber: number;
    text: string;
}

export interface TextSegment {
    text: string;
    segmentIndex: number;
    pageNumber?: number;
    wordCount: number;
}

export interface BookCardProps {
    title: string;
    author: string;
    coverURL: string;
    slug: string;
}

export interface Messages {
    role: string;
    content: string;
}

export interface ShadowBoxProps {
    children: ReactNode;
    className?: string;
}

export interface VoiceSelectorProps {
    disabled?: boolean;
    className?: string;
    value?: string;
    onChange: (voiceId: string) => void;
}

export interface InputFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    placeholder?: string;
    disabled?: boolean;
}

export interface FileUploadFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    acceptTypes: string[];
    disabled?: boolean;
    icon: LucideIcon;
    placeholder: string;
    hint: string;
}

export interface SessionCheckResult {
    allowed: boolean;
    currentCount: number;
    limit: number;
    plan: PlanType;
    maxDurationMinutes: number;
    error?: string;
}

export interface StartSessionResult {
    success: boolean;
    sessionId?: string;
    maxDurationMinutes?: number;
    error?: string;
    isBillingError?: boolean;
}

export interface EndSessionResult {
    success: boolean;
    error?: string;
}

export type TurnRole = 'assistant' | 'user';

export interface SaveTurnInput {
    sessionId: string;
    turnIndex: number;
    role: TurnRole;
    content: string;
    /** Epoch milliseconds. */
    startedAt: number;
    /** Epoch milliseconds. */
    endedAt: number;
    /** Only on student turns: end of the agent question -> student's first word. */
    studentLatencyMs?: number | null;
    /** Only on agent turns: end of the student turn -> start of the agent reply. */
    systemLatencyMs?: number | null;
}

export interface SaveTurnResult {
    success: boolean;
    turnId?: string;
    error?: string;
}
