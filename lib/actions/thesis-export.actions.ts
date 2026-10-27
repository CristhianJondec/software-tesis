'use server';

import { asc, count, countDistinct, eq, max, min, sum } from 'drizzle-orm';
import ExcelJS from 'exceljs';

import { db } from '@/database/db';
import { books, sessionTurns, studyMaterials, surveyResponses, users, voiceSessions } from '@/database/schema';
import { requireAdmin } from '@/lib/admin/access';
import { FEEDBACK_PROMPT_VERSION } from '@/lib/feedback/evaluate';
import {
    fetchEvaluations,
    fetchRagasScores,
    fetchRetrievals,
    fetchSessions,
    fetchTurnFeedback,
    fetchTurns,
} from '@/lib/metrics/queries';
import { RAGAS_PROMPT_VERSION } from '@/lib/metrics/ragas';
import { buildMetricsReport, type MetricsInput } from '@/lib/metrics/report';
import { readGlobalVoiceLimit } from '@/lib/study/usage.server';
import { buildSurveyProgress } from '@/lib/surveys/progress';
import { parseExportOptions, selectExportUsers } from '@/lib/thesis-export/options';
import { buildThesisSheets, type ExportSheet } from '@/lib/thesis-export/sheets';

// Excel rejects cells longer than this; only a very long transcript turn could hit it.
const MAX_CELL_LENGTH = 32_767;

async function loadMetricsInput(): Promise<MetricsInput> {
    const [turns, sessions, retrievals, evaluations, ragasRows, feedbackRows] = await Promise.all([
        fetchTurns(),
        fetchSessions(),
        fetchRetrievals(),
        fetchEvaluations(),
        fetchRagasScores(RAGAS_PROMPT_VERSION),
        fetchTurnFeedback(FEEDBACK_PROMPT_VERSION),
    ]);
    return { turns, sessions, retrievals, evaluations, ragasRows, feedbackRows };
}

/** Keeps only the rows of the selected participants, so every sheet and metric agrees with them. */
function restrictMetricsInput(input: MetricsInput, userIds: Set<string>): MetricsInput {
    const sessions = input.sessions.filter((row) => userIds.has(row.userId));
    const turns = input.turns.filter((row) => userIds.has(row.userId));
    const sessionIds = new Set(sessions.map((row) => row.sessionId));
    const turnIds = new Set(turns.map((row) => row.turnId));
    return {
        sessions,
        turns,
        retrievals: input.retrievals.filter((row) => row.sessionId !== null && sessionIds.has(row.sessionId)),
        evaluations: input.evaluations.filter((row) => turnIds.has(row.turnId)),
        ragasRows: input.ragasRows.filter((row) => turnIds.has(row.turnId)),
        feedbackRows: input.feedbackRows.filter((row) => turnIds.has(row.turnId)),
    };
}

function addSheet(workbook: ExcelJS.Workbook, sheet: ExportSheet) {
    const worksheet = workbook.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    worksheet.addRow([...sheet.headers]);
    for (const row of sheet.rows) {
        worksheet.addRow(
            row.map((cell) => {
                if (cell === null || cell === undefined) return null;
                if (typeof cell === 'string' && cell.length > MAX_CELL_LENGTH) return cell.slice(0, MAX_CELL_LENGTH);
                return cell;
            }),
        );
    }

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6E5' } };
    if (sheet.headers.length > 0) {
        worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.headers.length } };
    }

    worksheet.columns.forEach((column, index) => {
        const header = sheet.headers[index] ?? '';
        let width = header.length;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            if (cell.value instanceof Date) {
                cell.numFmt = 'yyyy-mm-dd hh:mm:ss';
                width = Math.max(width, 19);
            } else if (cell.value !== null && cell.value !== undefined) {
                width = Math.max(width, String(cell.value).length);
            }
        });
        column.width = Math.min(Math.max(width + 2, 8), 60);
    });
}

/**
 * Builds the thesis workbook (.xlsx) from everything the platform stored, for
 * the participants the export modal selected (lib/thesis-export/options.ts).
 * Works at any point of the study: whatever is missing goes out as empty cells.
 */
export async function exportThesisWorkbook(rawOptions?: unknown): Promise<{
    success: boolean;
    data?: { filename: string; base64: string };
    error?: string;
}> {
    try {
        await requireAdmin();
        const options = parseExportOptions(rawOptions);

        const [allUsers, responses, sessionUsage, uploads, conversations, materials, globalLimitMinutes, metricsInput] =
            await Promise.all([
                db.select({
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    participantCode: users.participantCode,
                    studyGroup: users.studyGroup,
                    createdAt: users.createdAt,
                    voiceMinutesLimit: users.voiceMinutesLimit,
                }).from(users).orderBy(asc(users.createdAt)),
                db.select({
                    userId: surveyResponses.userId,
                    surveyType: surveyResponses.surveyType,
                    phase: surveyResponses.phase,
                    answers: surveyResponses.answers,
                    computedScore: surveyResponses.computedScore,
                    submittedAt: surveyResponses.submittedAt,
                }).from(surveyResponses),
                db.select({
                    userId: voiceSessions.userId,
                    sessions: count(voiceSessions.id),
                    usedSeconds: sum(voiceSessions.durationSeconds),
                    firstSessionAt: min(voiceSessions.startedAt),
                    lastSessionAt: max(voiceSessions.startedAt),
                }).from(voiceSessions).groupBy(voiceSessions.userId),
                db.select({ userId: books.userId, uploads: countDistinct(books.id) }).from(books).groupBy(books.userId),
                db.selectDistinct({ userId: voiceSessions.userId })
                    .from(voiceSessions)
                    .innerJoin(sessionTurns, eq(sessionTurns.sessionId, voiceSessions.id))
                    .where(eq(sessionTurns.role, 'user')),
                db.select({
                    title: studyMaterials.title,
                    description: studyMaterials.description,
                    fileName: studyMaterials.fileName,
                    fileSize: studyMaterials.fileSize,
                    createdAt: studyMaterials.createdAt,
                }).from(studyMaterials).orderBy(asc(studyMaterials.sortOrder), asc(studyMaterials.createdAt)),
                readGlobalVoiceLimit(),
                loadMetricsInput(),
            ]);

        const usersWithConversation = new Set(conversations.map((row) => row.userId));
        const responsesByUser = new Map<string, typeof responses>();
        for (const response of responses) {
            responsesByUser.set(response.userId, [...(responsesByUser.get(response.userId) ?? []), response]);
        }
        const selectedUsers = selectExportUsers(
            allUsers.map((user) => ({
                ...user,
                stages: buildSurveyProgress(user.studyGroup, responsesByUser.get(user.id) ?? [], usersWithConversation.has(user.id)),
            })),
            options,
        );
        if (selectedUsers.length === 0) {
            return { success: false, error: 'Ningún participante cumple las opciones elegidas.' };
        }
        const selectedIds = new Set(selectedUsers.map((user) => user.id));
        const exportedUsers = allUsers.filter((user) => selectedIds.has(user.id));
        const exportedMetrics = restrictMetricsInput(metricsInput, selectedIds);

        const uploadsByUser = new Map(uploads.map((row) => [row.userId, row.uploads]));
        const sessionsByUser = new Map(sessionUsage.map((row) => [row.userId, row]));
        const usage = exportedUsers.map((user) => {
            const sessions = sessionsByUser.get(user.id);
            return {
                userId: user.id,
                researchUploads: uploadsByUser.get(user.id) ?? 0,
                sessions: sessions?.sessions ?? 0,
                usedSeconds: Number(sessions?.usedSeconds ?? 0),
                firstSessionAt: sessions?.firstSessionAt ?? null,
                lastSessionAt: sessions?.lastSessionAt ?? null,
            };
        });

        const sheets = buildThesisSheets({
            users: exportedUsers,
            responses: responses.filter((row) => selectedIds.has(row.userId)),
            usage,
            usersWithConversation,
            materials,
            globalLimitMinutes,
            metricsInput: exportedMetrics,
            report: buildMetricsReport(exportedMetrics),
            anonymize: options.anonymize,
            includeTurns: options.includeTurns,
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Investfied';
        workbook.created = new Date();
        for (const sheet of sheets) addSheet(workbook, sheet);

        const buffer = await workbook.xlsx.writeBuffer();
        return {
            success: true,
            data: {
                filename: `datos-tesis-${new Date().toISOString().slice(0, 10)}.xlsx`,
                base64: Buffer.from(buffer).toString('base64'),
            },
        };
    } catch (error) {
        console.error('Error exporting thesis workbook', error);
        return { success: false, error: error instanceof Error ? error.message : 'No se pudo generar el archivo.' };
    }
}
