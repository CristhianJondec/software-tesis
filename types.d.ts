import { ReactNode } from 'react';
import { Control, FieldPath, FieldValues } from 'react-hook-form';
import { LucideIcon } from 'lucide-react';
import type { InferSelectModel } from 'drizzle-orm';
import z from 'zod';
import { UploadSchema } from '@/lib/zod';
import { books, bookSegments, sessionTurns, turnRetrievals, voiceSessions } from '@/database/schema';
import type { PreviousSessionSummary } from '@/lib/difficulty/adaptation';
import type { DifficultyLevelId, LevelSource } from '@/lib/difficulty/levels';
import type { PreparationTopicId } from '@/lib/preparation/topics';
import type { PredictionAnswers } from '@/lib/prediction/questions';

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
    id: string;
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

export interface StartSessionInput {
    /** Level the student confirmed on the pre-session screen, 1-4. */
    difficultyLevel?: number;
    /** Self-report 0-10 taken right before starting. Undefined if skipped. */
    preSessionAnxiety?: number | null;
    /**
     * Topics the student asked to practise, from the preparation map. Empty or
     * undefined runs the whole defense. Narrowed again on the server.
     */
    focusTopics?: string[];
    /**
     * The three written predictions taken before connecting
     * (docs/propuestas/04). All three optional; narrowed and tagged server-side.
     */
    prediction?: PredictionAnswers;
}

export interface StartSessionResult {
    success: boolean;
    sessionId?: string;
    maxDurationMinutes?: number;
    /** Level the server actually stored — the client must run the session at this one. */
    difficultyLevel?: DifficultyLevelId;
    /** Derived server-side by re-running the rule, never taken from the client. */
    levelSource?: LevelSource;
    /** Topics the server accepted for this session. The prompt must use these. */
    focusTopics?: PreparationTopicId[];
    error?: string;
}

export interface SessionPreparation {
    /** Last finished session with this document, or null on the first one. */
    previous: PreviousSessionSummary | null;
    /** ISO date of that session, shown to the student next to the justification. */
    previousStartedAt: string | null;
    /**
     * What the student declared they would try differently when that session
     * closed. Shown back before this one starts (docs/propuestas/04).
     */
    previousStrategy: string | null;
}

export interface SessionPreparationResult {
    success: boolean;
    data?: SessionPreparation;
    error?: string;
}

export interface SaveAnxietyResult {
    success: boolean;
    error?: string;
}

export interface EndSessionResult {
    success: boolean;
    error?: string;
}

export interface LinkVapiCallResult {
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
    /** Only on student turns: longest gap between two consecutive partial transcripts. */
    maxPauseMs?: number | null;
}

export interface SaveTurnResult {
    success: boolean;
    turnId?: string;
    error?: string;
}
