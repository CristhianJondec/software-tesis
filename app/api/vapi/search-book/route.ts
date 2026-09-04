import { NextResponse, after } from 'next/server';

import { searchBookSegments } from '@/lib/actions/book.actions';
import { RETRIEVER_TOP_K } from '@/lib/constants';
import { recordTurnRetrievals } from '@/lib/retrievals';

// Normalize an optional string argument coming from the Vapi tool call.
// `sessionId` is optional on purpose: the tool schema in the Vapi dashboard may
// not declare it yet (see docs/02). Without it retrievals simply go unrecorded.
function optionalString(value: unknown): string | null {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str || str === 'null' || str === 'undefined') return null;
    return str;
}

// Helper function to process book search logic
async function processBookSearch(bookId: unknown, query: unknown, sessionId: unknown) {
    // Validate inputs before conversion to prevent null/undefined becoming "null"/"undefined" strings
    if (bookId == null || query == null || query === '') {
        return { result: 'Missing bookId or query' };
    }

    // Convert bookId to string
    const bookIdStr = String(bookId);
    const queryStr = String(query).trim();

    // Additional validation after conversion
    if (!bookIdStr || bookIdStr === 'null' || bookIdStr === 'undefined' || !queryStr) {
        return { result: 'Missing bookId or query' };
    }

    // Execute search. `searchBookSegments` already drops anything past the
    // relevance threshold, so an empty result means the document does not cover
    // the topic -- not that the search failed.
    const searchResult = await searchBookSegments(bookIdStr, queryStr, RETRIEVER_TOP_K);

    // Return results. This message is in Spanish because the LLM reads it and
    // the agent speaks Spanish: it has to say it out loud to the student.
    if (!searchResult.success || !searchResult.data?.length) {
        return {
            result:
                'No hay ningún fragmento relevante sobre ese tema en el documento del estudiante. ' +
                'Dilo explícitamente: el tema no aparece en la investigación. No inventes contenido ni cites páginas.',
        };
    }

    const segments = searchResult.data as Array<{
        id: string;
        content: string;
        pageNumber: number | null;
        distance: number;
    }>;

    // Prefix each fragment with its page so the LLM can cite "en la página X".
    const combinedText = segments
        .map((segment) =>
            segment.pageNumber != null
                ? `[Página ${segment.pageNumber}] ${segment.content}`
                : segment.content,
        )
        .join('\n\n');

    // Persist the evidence AFTER the response is built: Vapi must be answered fast.
    const sessionIdStr = optionalString(sessionId);
    if (sessionIdStr) {
        after(
            recordTurnRetrievals(
                sessionIdStr,
                queryStr,
                segments.map((segment) => ({
                    segmentId: segment.id,
                    distance: Number(segment.distance),
                })),
            ),
        );
    }

    return { result: combinedText };
}

export async function GET() {
    return NextResponse.json({ status: 'ok' });
}

// Parse tool arguments that may arrive as a JSON string or an object
function parseArgs(args: unknown): Record<string, unknown> {
    if (!args) return {};
    if (typeof args === 'string') {
        try { return JSON.parse(args); } catch { return {}; }
    }
    return args as Record<string, unknown>;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log('Vapi search-book request:', JSON.stringify(body, null, 2));

        // Support multiple Vapi formats
        const functionCall = body?.message?.functionCall;
        const toolCallList = body?.message?.toolCallList || body?.message?.toolCalls;

        // Handle single functionCall format
        if (functionCall) {
            const { name, parameters } = functionCall;
            const parsed = parseArgs(parameters);

            if (name === 'searchBook') {
                const result = await processBookSearch(parsed.bookId, parsed.query, parsed.sessionId);
                return NextResponse.json(result);
            }

            return NextResponse.json({ result: `Unknown function: ${name}` });
        }

        // Handle toolCallList format (array of calls)
        if (!toolCallList || toolCallList.length === 0) {
            return NextResponse.json({
                results: [{ result: 'No tool calls found' }],
            });
        }

        const results = [];

        for (const toolCall of toolCallList) {
            const { id, function: func } = toolCall;
            const name = func?.name;
            const args = parseArgs(func?.arguments);

            if (name === 'searchBook') {
                const searchResult = await processBookSearch(args.bookId, args.query, args.sessionId);
                results.push({ toolCallId: id, ...searchResult });
            } else {
                results.push({ toolCallId: id, result: `Unknown function: ${name}` });
            }
        }

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Vapi search-book error:', error);
        return NextResponse.json({
            results: [{ result: 'Error processing request' }],
        });
    }
}
