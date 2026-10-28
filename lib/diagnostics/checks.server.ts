import 'server-only';

import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { and, count, desc, eq, inArray, is, sql } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

import { db } from '@/database/db';
import * as schema from '@/database/schema';
import { books, sessionTurns, systemLogs, users, voiceSessions } from '@/database/schema';
import { searchBookSegments } from '@/lib/actions/book.actions';
import { RETRIEVER_MAX_DISTANCE, RETRIEVER_TOP_K } from '@/lib/constants';
import { APP_ENV_VARS } from '@/lib/diagnostics/env.server';
import { embeddingErrorStatus, generateQueryEmbedding } from '@/lib/embeddings';
import { geminiJudge, JUDGE_MODEL } from '@/lib/metrics/judge';
import { r2, R2_BUCKET } from '@/lib/r2';
import { describeError } from '@/lib/system-logs/write.server';
import { getVapiCallDetails } from '@/lib/vapi.server';

/**
 * Checks behind /admin/diagnostico. Each one exercises a real dependency from
 * the server that serves the app (environment, database, Gemini, Vapi, R2) and
 * says in Spanish what is wrong and how to fix it, so a broken session can be
 * traced to one component instead of guessed.
 *
 * Server-only; the page authorizes the admin before calling anything here.
 * Secrets are never returned: only whether they are set and their last four
 * characters.
 */

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';

export interface DiagnosticCheck {
    id: string;
    group: string;
    label: string;
    status: CheckStatus;
    detail: string;
    fix?: string;
    durationMs?: number;
}

const TIMEOUT_MS = 8_000;
const WEBHOOK_PATH = '/api/vapi/search-book';

function lastFour(value: string): string {
    return value.length > 8 ? `…${value.slice(-4)}` : '(muy corta)';
}

async function timed(run: () => Promise<Omit<DiagnosticCheck, 'durationMs'>>): Promise<DiagnosticCheck> {
    const startedAt = Date.now();
    const result = await run();
    return { ...result, durationMs: Date.now() - startedAt };
}

function hostOf(url: string | undefined | null): string | null {
    if (!url) return null;
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function checkEnvironment(origin: string): DiagnosticCheck[] {
    const required = APP_ENV_VARS.filter((variable) => variable.required);
    const checks: DiagnosticCheck[] = required.map(({ name, purpose, secret }) => {
        const value = process.env[name]?.trim();
        return value
            ? { id: `env-${name}`, group: 'Configuración', label: name, status: 'ok', detail: secret ? `Configurada (${lastFour(value)}).` : `Configurada: ${value}` }
            : {
                id: `env-${name}`,
                group: 'Configuración',
                label: name,
                status: 'fail',
                detail: `Falta. Se usa para: ${purpose.toLowerCase()}.`,
                fix: `Agrégala en las variables de entorno del deploy y vuelve a desplegar.${name.startsWith('NEXT_PUBLIC_') ? ' Al ser NEXT_PUBLIC_, hace falta un build nuevo, no solo reiniciar.' : ''}`,
            };
    });

    const currentHost = hostOf(origin);
    for (const name of ['NEXT_PUBLIC_BASE_URL', 'BETTER_AUTH_URL'] as const) {
        const configured = process.env[name];
        if (!configured) continue;
        const configuredHost = hostOf(configured);
        checks.push(
            configuredHost === currentHost
                ? { id: `domain-${name}`, group: 'Configuración', label: `${name} coincide con el dominio`, status: 'ok', detail: `${configured} = dominio actual.` }
                : {
                    id: `domain-${name}`,
                    group: 'Configuración',
                    label: `${name} coincide con el dominio`,
                    status: 'fail',
                    detail: `Apunta a ${configured}, pero la app se está sirviendo desde ${origin}.`,
                    fix: `Cámbiala a ${origin} y vuelve a desplegar.`,
                },
        );
    }

    const judgeOverride = process.env.GEMINI_JUDGE_MODEL;
    if (judgeOverride) {
        checks.push({
            id: 'env-GEMINI_JUDGE_MODEL',
            group: 'Configuración',
            label: 'GEMINI_JUDGE_MODEL',
            status: judgeOverride.includes('2.5') ? 'fail' : 'warn',
            detail: `Reemplaza el modelo del juez por «${judgeOverride}».`,
            fix: judgeOverride.includes('2.5')
                ? 'gemini-2.5-flash ya no está disponible para cuentas nuevas: borra esta variable.'
                : 'Si no la pusiste a propósito, bórrala para usar el modelo del código.',
        });
    }
    return checks;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

async function checkDatabase(): Promise<DiagnosticCheck[]> {
    const connection = await timed(async () => {
        try {
            await db.execute(sql`select 1`);
            return { id: 'db-connection', group: 'Base de datos', label: 'Conexión', status: 'ok', detail: 'La base responde.' };
        } catch (error) {
            return {
                id: 'db-connection',
                group: 'Base de datos',
                label: 'Conexión',
                status: 'fail',
                detail: describeError(error),
                fix: 'Revisa DATABASE_URL y que la base acepte conexiones desde el deploy.',
            };
        }
    });
    if (connection.status !== 'ok') return [connection];

    // Migrations are pasted by hand in the Supabase SQL editor, so Drizzle's own
    // registry (drizzle.__drizzle_migrations) is not reliable. Compare the real
    // columns with the ones the code's schema declares instead.
    const columns = await timed(async () => {
        const base = { id: 'db-schema', group: 'Base de datos', label: 'Tablas y columnas' };
        try {
            const rows = await db.execute<{ table_name: string; column_name: string }>(
                sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
            );
            const existing = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
            const existingTables = new Set(rows.map((row) => row.table_name));

            const missingTables: string[] = [];
            const missingColumns: string[] = [];
            for (const value of Object.values(schema)) {
                if (!is(value, PgTable)) continue;
                const config = getTableConfig(value);
                if (!existingTables.has(config.name)) {
                    missingTables.push(config.name);
                    continue;
                }
                for (const column of config.columns) {
                    if (!existing.has(`${config.name}.${column.name}`)) missingColumns.push(`${config.name}.${column.name}`);
                }
            }

            if (missingTables.length === 0 && missingColumns.length === 0) {
                return { ...base, status: 'ok' as const, detail: 'La base tiene todas las tablas y columnas que usa el código.' };
            }
            return {
                ...base,
                status: 'fail' as const,
                detail: [
                    missingTables.length > 0 ? `Faltan tablas: ${missingTables.join(', ')}.` : '',
                    missingColumns.length > 0 ? `Faltan columnas: ${missingColumns.join(', ')}.` : '',
                ].filter(Boolean).join(' '),
                fix: 'Pega en el SQL Editor de Supabase la migración de drizzle/ que las crea.',
            };
        } catch (error) {
            return { ...base, status: 'warn' as const, detail: `No se pudo leer el esquema: ${describeError(error)}` };
        }
    });

    const unprocessed = await timed(async () => {
        const base = { id: 'db-unprocessed', group: 'Base de datos', label: 'Investigaciones sin procesar' };
        try {
            // Ten minutes of grace so an upload still in progress is not flagged.
            const rows = await db
                .select({ title: books.title, participantCode: users.participantCode, userName: users.name })
                .from(books)
                .innerJoin(users, eq(books.userId, users.id))
                .where(and(eq(books.totalSegments, 0), sql`${books.createdAt} < now() - interval '10 minutes'`));
            if (rows.length === 0) {
                return { ...base, status: 'ok' as const, detail: 'Todas las investigaciones tienen sus segmentos.' };
            }
            return {
                ...base,
                status: 'warn' as const,
                detail: `${rows.length} sin segmentos: ${rows.map((row) => `${row.participantCode ?? row.userName} («${row.title.slice(0, 60)}»)`).join('; ')}.`,
                fix: 'No se puede iniciar sesión con ellas. El estudiante verá un aviso para eliminarla y volver a subirla (no pierde su cupo).',
            };
        } catch (error) {
            return { ...base, status: 'warn' as const, detail: describeError(error) };
        }
    });

    return [connection, columns, unprocessed];
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

function geminiFix(status: number | null): string {
    switch (status) {
        case 400:
        case 401:
        case 403:
            return 'La clave no es válida o no tiene permiso: revisa GEMINI_API_KEY.';
        case 402:
            return 'Sin crédito de prepago: recarga en AI Studio → Facturación del proyecto.';
        case 404:
            return 'El modelo no existe para esta cuenta: hay que cambiarlo en el código.';
        case 429:
            return 'Cuota agotada (plan gratuito o límite por minuto): espera o activa la facturación.';
        default:
            return 'Revisa GEMINI_API_KEY y el estado de la facturación en AI Studio.';
    }
}

async function checkGemini(): Promise<DiagnosticCheck[]> {
    if (!process.env.GEMINI_API_KEY) {
        return [{ id: 'gemini', group: 'Gemini', label: 'Gemini', status: 'skip', detail: 'Sin GEMINI_API_KEY no se puede probar.' }];
    }

    return Promise.all([
        timed(async () => {
            try {
                const vector = await generateQueryEmbedding('prueba de diagnóstico');
                return vector.length === 768
                    ? { id: 'gemini-embeddings', group: 'Gemini', label: 'Embeddings (subida y retriever)', status: 'ok', detail: 'gemini-embedding-001 respondió con 768 dimensiones.' }
                    : {
                        id: 'gemini-embeddings',
                        group: 'Gemini',
                        label: 'Embeddings (subida y retriever)',
                        status: 'fail',
                        detail: `Devolvió ${vector.length} dimensiones; la base espera 768.`,
                    };
            } catch (error) {
                const status = embeddingErrorStatus(error);
                return {
                    id: 'gemini-embeddings',
                    group: 'Gemini',
                    label: 'Embeddings (subida y retriever)',
                    status: 'fail',
                    detail: `${status ? `HTTP ${status}: ` : ''}${describeError(error).slice(0, 300)}`,
                    fix: geminiFix(status),
                };
            }
        }),
        timed(async () => {
            try {
                await geminiJudge('Responde solo con este JSON: {"ok": true}');
                return { id: 'gemini-judge', group: 'Gemini', label: 'Juez del informe', status: 'ok', detail: `${JUDGE_MODEL} respondió JSON válido.` };
            } catch (error) {
                const status = embeddingErrorStatus(error);
                return {
                    id: 'gemini-judge',
                    group: 'Gemini',
                    label: 'Juez del informe',
                    status: 'fail',
                    detail: `${JUDGE_MODEL}: ${status ? `HTTP ${status}: ` : ''}${describeError(error).slice(0, 300)}`,
                    fix: geminiFix(status),
                };
            }
        }),
    ]);
}

// ---------------------------------------------------------------------------
// Vapi
// ---------------------------------------------------------------------------

async function vapiGet(path: string, key: string): Promise<{ status: number; body: Record<string, unknown> | null }> {
    const response = await fetch(`https://api.vapi.ai${path}`, {
        headers: { Authorization: `Bearer ${key}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = response.ok ? ((await response.json()) as Record<string, unknown>) : null;
    return { status: response.status, body };
}

interface ToolInfo {
    name: string | null;
    url: string | null;
}

function toolInfo(tool: Record<string, unknown>): ToolInfo {
    const fn = tool.function as { name?: string } | undefined;
    const server = tool.server as { url?: string } | undefined;
    return { name: fn?.name ?? null, url: server?.url ?? (tool.serverUrl as string | undefined) ?? null };
}

/** POSTs an empty tool-call list to the webhook: our handler answers "No tool calls found". */
async function probeWebhook(url: string): Promise<Omit<DiagnosticCheck, 'durationMs'>> {
    const base = { id: 'vapi-webhook', group: 'Vapi', label: 'El webhook del retriever responde' };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { toolCallList: [] } }),
            cache: 'no-store',
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const text = await response.text();
        if (response.ok && text.includes('No tool calls found')) {
            return { ...base, status: 'ok', detail: `${url} respondió como se espera.` };
        }
        return {
            ...base,
            status: 'fail',
            detail: `${url} respondió HTTP ${response.status}: ${text.slice(0, 200)}`,
            fix: response.status === 401 || response.status === 403
                ? 'El deploy bloquea peticiones externas (p. ej., Vercel Deployment Protection). Desactívala para producción o usa el dominio público.'
                : 'Esa URL no llega a esta app: corrige la Server URL del tool searchBook.',
        };
    } catch (error) {
        return {
            ...base,
            status: 'fail',
            detail: `No se pudo conectar con ${url}: ${describeError(error)}`,
            fix: 'El dominio no responde o no existe: corrige la Server URL del tool searchBook.',
        };
    }
}

async function checkVapi(origin: string): Promise<DiagnosticCheck[]> {
    const key = process.env.VAPI_PRIVATE_API_KEY;
    const assistantId = process.env.NEXT_PUBLIC_ASSISTANT_ID;
    const expectedUrl = `${origin}${WEBHOOK_PATH}`;
    if (!key || !assistantId) {
        return [
            {
                id: 'vapi',
                group: 'Vapi',
                label: 'Vapi',
                status: 'skip',
                detail: 'Sin VAPI_PRIVATE_API_KEY o NEXT_PUBLIC_ASSISTANT_ID no se puede revisar el assistant.',
            },
            await timed(() => probeWebhook(expectedUrl)),
        ];
    }

    const checks: DiagnosticCheck[] = [];
    const assistant = await timed(async () => {
        try {
            const { status, body } = await vapiGet(`/assistant/${encodeURIComponent(assistantId)}`, key);
            if (status === 401 || status === 403) {
                return { id: 'vapi-assistant', group: 'Vapi', label: 'API key y assistant', status: 'fail', detail: `Vapi rechazó la clave (HTTP ${status}).`, fix: 'Revisa VAPI_PRIVATE_API_KEY: debe ser la clave privada, no la pública.' };
            }
            if (status === 404 || !body) {
                return { id: 'vapi-assistant', group: 'Vapi', label: 'API key y assistant', status: 'fail', detail: `No existe el assistant ${assistantId} (HTTP ${status}).`, fix: 'Revisa NEXT_PUBLIC_ASSISTANT_ID en el deploy (requiere un build nuevo).' };
            }
            return { id: 'vapi-assistant', group: 'Vapi', label: 'API key y assistant', status: 'ok', detail: `Assistant «${String(body.name ?? assistantId)}» encontrado.` };
        } catch (error) {
            return { id: 'vapi-assistant', group: 'Vapi', label: 'API key y assistant', status: 'fail', detail: describeError(error) };
        }
    });
    checks.push(assistant);
    if (assistant.status !== 'ok') {
        checks.push(await timed(() => probeWebhook(expectedUrl)));
        return checks;
    }

    // The searchBook tool lives in the dashboard (CLAUDE.md): attached by id or inline.
    let searchTool: ToolInfo | null = null;
    const toolCheck = await timed(async () => {
        try {
            const { body } = await vapiGet(`/assistant/${encodeURIComponent(assistantId)}`, key);
            const model = (body?.model ?? {}) as { toolIds?: string[]; tools?: Record<string, unknown>[] };
            const tools: ToolInfo[] = (model.tools ?? []).map(toolInfo);
            for (const toolId of model.toolIds ?? []) {
                const { body: tool } = await vapiGet(`/tool/${encodeURIComponent(toolId)}`, key);
                if (tool) tools.push(toolInfo(tool));
            }
            searchTool = tools.find((tool) => tool.name === 'searchBook') ?? null;
            if (!searchTool) {
                return {
                    id: 'vapi-tool',
                    group: 'Vapi',
                    label: 'Tool searchBook en el assistant',
                    status: 'fail',
                    detail: `El assistant no tiene el tool searchBook (tiene: ${tools.map((tool) => tool.name ?? '?').join(', ') || 'ninguno'}).`,
                    fix: 'Sin este tool el agente nunca consulta la tesis. Agrégalo al assistant en el dashboard de Vapi.',
                };
            }
            if (!searchTool.url) {
                return { id: 'vapi-tool', group: 'Vapi', label: 'Tool searchBook en el assistant', status: 'fail', detail: 'El tool searchBook no tiene Server URL.', fix: `Ponle la Server URL ${expectedUrl}` };
            }
            if (hostOf(searchTool.url) !== hostOf(origin) || !searchTool.url.includes(WEBHOOK_PATH)) {
                return {
                    id: 'vapi-tool',
                    group: 'Vapi',
                    label: 'Tool searchBook en el assistant',
                    status: 'fail',
                    detail: `La Server URL es ${searchTool.url}, pero la app está en ${origin}.`,
                    fix: `Dashboard de Vapi → Tools → searchBook → Server URL: ${expectedUrl}`,
                };
            }
            return { id: 'vapi-tool', group: 'Vapi', label: 'Tool searchBook en el assistant', status: 'ok', detail: `Apunta a ${searchTool.url}` };
        } catch (error) {
            return { id: 'vapi-tool', group: 'Vapi', label: 'Tool searchBook en el assistant', status: 'fail', detail: describeError(error) };
        }
    });
    checks.push(toolCheck);

    const toolUrl = (searchTool as ToolInfo | null)?.url;
    checks.push(await timed(() => probeWebhook(toolUrl ?? expectedUrl)));
    return checks;
}

// ---------------------------------------------------------------------------
// R2
// ---------------------------------------------------------------------------

async function checkStorage(): Promise<DiagnosticCheck> {
    return timed(async () => {
        if (!R2_BUCKET || !process.env.R2_ACCESS_KEY_ID) {
            return { id: 'r2', group: 'Almacenamiento', label: 'Bucket de R2', status: 'skip', detail: 'Faltan las variables de R2.' };
        }
        try {
            await r2.send(new HeadBucketCommand({ Bucket: R2_BUCKET }), { abortSignal: AbortSignal.timeout(TIMEOUT_MS) });
            return { id: 'r2', group: 'Almacenamiento', label: 'Bucket de R2', status: 'ok', detail: `El bucket «${R2_BUCKET}» es accesible.` };
        } catch (error) {
            return {
                id: 'r2',
                group: 'Almacenamiento',
                label: 'Bucket de R2',
                status: 'fail',
                detail: describeError(error),
                fix: 'Revisa R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME.',
            };
        }
    });
}

export async function runDiagnostics(origin: string): Promise<DiagnosticCheck[]> {
    const [database, gemini, vapi, storage] = await Promise.all([
        checkDatabase(),
        checkGemini(),
        checkVapi(origin),
        checkStorage(),
    ]);
    return [...checkEnvironment(origin), ...database, ...gemini, ...vapi, storage];
}

// ---------------------------------------------------------------------------
// Recent sessions: did the agent actually reach the retriever?
// ---------------------------------------------------------------------------

export interface RecentSessionDiagnosis {
    id: string;
    startedAt: Date;
    durationSeconds: number;
    participant: string;
    agentTurns: number;
    searches: number;
    noResults: number;
    searchErrors: number;
    endedReason: string;
    verdict: CheckStatus;
    explanation: string;
}

export async function diagnoseRecentSessions(limit = 5): Promise<RecentSessionDiagnosis[]> {
    const sessions = await db
        .select({
            id: voiceSessions.id,
            startedAt: voiceSessions.startedAt,
            durationSeconds: voiceSessions.durationSeconds,
            vapiCallId: voiceSessions.vapiCallId,
            participantCode: users.participantCode,
            userName: users.name,
        })
        .from(voiceSessions)
        .innerJoin(users, eq(voiceSessions.userId, users.id))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(limit);
    if (sessions.length === 0) return [];

    const ids = sessions.map((session) => session.id);
    const [turnCounts, logCounts, calls] = await Promise.all([
        db
            .select({ sessionId: sessionTurns.sessionId, n: count() })
            .from(sessionTurns)
            .where(and(inArray(sessionTurns.sessionId, ids), eq(sessionTurns.role, 'assistant')))
            .groupBy(sessionTurns.sessionId),
        db
            .select({ sessionId: systemLogs.sessionId, event: systemLogs.event, level: systemLogs.level, n: count() })
            .from(systemLogs)
            .where(and(
                inArray(systemLogs.sessionId, ids),
                inArray(systemLogs.event, ['retriever.search', 'retriever.no_results']),
            ))
            .groupBy(systemLogs.sessionId, systemLogs.event, systemLogs.level),
        Promise.all(sessions.map((session) => (session.vapiCallId ? getVapiCallDetails(session.vapiCallId) : null))),
    ]);

    return sessions.map((session, index) => {
        const logs = logCounts.filter((row) => row.sessionId === session.id);
        const sum = (predicate: (row: (typeof logs)[number]) => boolean) =>
            logs.filter(predicate).reduce((total, row) => total + row.n, 0);
        const searches = sum((row) => row.event === 'retriever.search' && row.level !== 'error');
        const searchErrors = sum((row) => row.event === 'retriever.search' && row.level === 'error');
        const noResults = sum((row) => row.event === 'retriever.no_results');
        const agentTurns = turnCounts.find((row) => row.sessionId === session.id)?.n ?? 0;

        const call = calls[index];
        const endedReason = !call
            ? 'Sin ID de llamada'
            : call.status === 'available'
                ? call.endedReason ?? 'En curso'
                : call.status === 'not-configured'
                    ? 'Falta VAPI_PRIVATE_API_KEY'
                    : call.status === 'not-found'
                        ? 'Vapi no encuentra la llamada'
                        : 'Vapi no respondió';

        const total = searches + noResults + searchErrors;
        let verdict: CheckStatus = 'ok';
        let explanation = `${searches} búsqueda(s) con fragmentos.`;
        if (agentTurns >= 3 && total === 0) {
            verdict = 'fail';
            explanation = 'El agente habló pero nunca consultó la tesis: el tool searchBook no llega a esta app.';
        } else if (searchErrors > 0) {
            verdict = 'fail';
            explanation = `${searchErrors} búsqueda(s) fallaron en el servidor (revisa Gemini).`;
        } else if (noResults > 0 && searches === 0) {
            verdict = 'warn';
            explanation = 'Todas las búsquedas quedaron sin fragmentos: el umbral de relevancia podría ser muy estricto. Usa el probador del retriever.';
        } else if (noResults > 0) {
            verdict = 'warn';
            explanation = `${searches} con fragmentos y ${noResults} sin fragmentos relevantes.`;
        } else if (total === 0) {
            verdict = 'skip';
            explanation = 'Sesión demasiado corta para juzgar.';
        }

        return {
            id: session.id,
            startedAt: session.startedAt,
            durationSeconds: session.durationSeconds,
            participant: `${session.participantCode ?? 'Sin código'} · ${session.userName}`,
            agentTurns,
            searches,
            noResults,
            searchErrors,
            endedReason,
            verdict,
            explanation,
        };
    });
}

// ---------------------------------------------------------------------------
// Retriever probe
// ---------------------------------------------------------------------------

export interface RetrieverBookOption {
    id: string;
    label: string;
    segments: number;
}

export async function listRetrieverBooks(): Promise<RetrieverBookOption[]> {
    const rows = await db
        .select({
            id: books.id,
            title: books.title,
            segments: books.totalSegments,
            participantCode: users.participantCode,
            userName: users.name,
        })
        .from(books)
        .innerJoin(users, eq(books.userId, users.id))
        .orderBy(desc(books.createdAt));
    return rows.map((row) => ({
        id: row.id,
        label: `${row.participantCode ?? row.userName} — ${row.title}`,
        segments: row.segments,
    }));
}

export interface RetrieverProbeRow {
    pageNumber: number | null;
    distance: number;
    passes: boolean;
    preview: string;
}

/**
 * Runs the retriever with the threshold lifted, so the admin sees the real
 * distances of the nearest segments and which of them the live agent would get.
 */
export async function probeRetriever(
    bookId: string,
    query: string,
): Promise<{ success: boolean; rows: RetrieverProbeRow[]; error?: string }> {
    const result = await searchBookSegments(bookId, query, RETRIEVER_TOP_K, 2);
    if (!result.success) return { success: false, rows: [], error: String(result.error ?? 'Error desconocido') };
    return {
        success: true,
        rows: (result.data ?? []).map((row) => {
            const distance = Number(row.distance);
            return {
                pageNumber: row.pageNumber,
                distance,
                passes: distance <= RETRIEVER_MAX_DISTANCE,
                preview: row.content.slice(0, 220),
            };
        }),
    };
}
