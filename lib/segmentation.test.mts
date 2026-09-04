import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    SEGMENT_OVERLAP_WORDS,
    SEGMENT_SIZE_WORDS,
    splitIntoSegments,
} from './segmentation.ts';

// Builds a page whose words are unique and traceable: "p3w7" is word 7 of page 3.
const page = (pageNumber: number, wordCount: number) => ({
    pageNumber,
    text: Array.from({ length: wordCount }, (_, i) => `p${pageNumber}w${i + 1}`).join(' '),
});

describe('splitIntoSegments', () => {
    it('returns no segments for an empty document', () => {
        assert.deepEqual(splitIntoSegments([]), []);
        assert.deepEqual(splitIntoSegments([{ pageNumber: 1, text: '   ' }]), []);
    });

    it('keeps the reported window and overlap by default', () => {
        assert.equal(SEGMENT_SIZE_WORDS, 500);
        assert.equal(SEGMENT_OVERLAP_WORDS, 50);

        // Two full windows: 500 words, then a window starting at word 451.
        const segments = splitIntoSegments([page(1, 900)]);

        assert.equal(segments.length, 2);
        assert.equal(segments[0].wordCount, 500);
        assert.equal(segments[1].wordCount, 450);
        assert.equal(segments[0].text.split(' ')[0], 'p1w1');
        assert.equal(segments[1].text.split(' ')[0], 'p1w451');
        assert.deepEqual(
            segments.map((s) => s.segmentIndex),
            [0, 1],
        );
    });

    it('assigns every segment the page where it starts', () => {
        // 3 pages of 10 words; windows of 4 with an overlap of 1 start at word
        // 1, 4, 7, 10, 13, ... -> pages 1, 1, 1, 1, 2, ...
        const pages = [page(1, 10), page(2, 10), page(3, 10)];
        const segments = splitIntoSegments(pages, 4, 1);

        assert.deepEqual(
            segments.map((s) => s.pageNumber),
            [1, 1, 1, 1, 2, 2, 2, 3, 3, 3],
        );
        // Page numbers never go backwards.
        segments.forEach((segment, i) => {
            if (i > 0) assert.ok(segment.pageNumber! >= segments[i - 1].pageNumber!);
        });
    });

    it('attributes a segment crossing a page boundary to its starting page', () => {
        // Window of 5 over 4 + 4 words: the first segment spans pages 1 and 2.
        const segments = splitIntoSegments([page(1, 4), page(2, 4)], 5, 1);

        assert.equal(segments[0].pageNumber, 1);
        assert.equal(segments[0].text, 'p1w1 p1w2 p1w3 p1w4 p2w1');
        assert.equal(segments[1].pageNumber, 2);
    });

    it('skips empty pages without breaking numbering', () => {
        const segments = splitIntoSegments([page(1, 3), { pageNumber: 2, text: '' }, page(3, 3)], 3, 0);

        assert.deepEqual(
            segments.map((s) => s.pageNumber),
            [1, 3],
        );
    });

    it('rejects parameters that would loop forever', () => {
        assert.throws(() => splitIntoSegments([page(1, 10)], 0, 0), /segmentSize/);
        assert.throws(() => splitIntoSegments([page(1, 10)], 5, 5), /overlapSize/);
        assert.throws(() => splitIntoSegments([page(1, 10)], 5, -1), /overlapSize/);
    });
});
