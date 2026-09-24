/**
 * Combines consecutive final transcript chunks emitted for one spoken turn.
 * Vapi providers may send a sentence as several `final` events, and some send
 * cumulative finals. Both forms must become one message and one database row.
 */
export function mergeTranscriptFragments(previous: string, incoming: string): string {
    const left = previous.trim();
    const right = incoming.trim();

    if (!left) return right;
    if (!right) return left;
    if (left === right) return left;
    if (right.startsWith(left)) return right;
    if (left.startsWith(right)) return left;

    const leftWords = left.split(/\s+/);
    const rightWords = right.split(/\s+/);
    const maxOverlap = Math.min(leftWords.length, rightWords.length);

    for (let size = maxOverlap; size > 0; size--) {
        const suffix = leftWords.slice(-size).join(' ').toLocaleLowerCase('es');
        const prefix = rightWords.slice(0, size).join(' ').toLocaleLowerCase('es');
        if (suffix === prefix) {
            return [...leftWords, ...rightWords.slice(size)].join(' ');
        }
    }

    return `${left} ${right}`;
}

export interface TranscriptMessage {
    role: string;
    content: string;
}

/** Adds a final chunk to the visible transcript without creating extra bubbles. */
export function mergeAdjacentTranscriptMessage(
    messages: readonly TranscriptMessage[],
    incoming: TranscriptMessage,
): TranscriptMessage[] {
    const content = incoming.content.trim();
    if (!content) return [...messages];

    const last = messages.at(-1);
    if (!last || last.role !== incoming.role) {
        return [...messages, { ...incoming, content }];
    }

    const merged = mergeTranscriptFragments(last.content, content);
    if (merged === last.content) return [...messages];

    return [...messages.slice(0, -1), { ...last, content: merged }];
}
