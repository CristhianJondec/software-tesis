import type { PdfPage, TextSegment } from '@/types';

// Segmentation parameters. Reported in the thesis as configuration of the
// ingestion pipeline: do NOT change these values.
// The retriever parameters (top-k and the relevance threshold) live in
// lib/constants.ts.

/** Segmentation window, in words. */
export const SEGMENT_SIZE_WORDS = 500;
/** Overlap between consecutive segments, in words. */
export const SEGMENT_OVERLAP_WORDS = 50;

// Splits the pages of a document into segments for storage and embedding.
// Takes pages instead of one concatenated string so that every segment keeps the
// page it came from: without it `book_segments.page_number` stays empty and the
// agent cannot cite a page.
export const splitIntoSegments = (
    pages: PdfPage[],
    segmentSize: number = SEGMENT_SIZE_WORDS, // Maximum words per segment
    overlapSize: number = SEGMENT_OVERLAP_WORDS, // Words to overlap between segments for context
): TextSegment[] => {
  // Validate parameters to prevent infinite loops
  if (segmentSize <= 0) {
    throw new Error('segmentSize must be greater than 0');
  }
  if (overlapSize < 0 || overlapSize >= segmentSize) {
    throw new Error('overlapSize must be >= 0 and < segmentSize');
  }

  // Flatten every page into a single word stream, remembering which page each
  // word came from. Segments are cut over this stream, so the window size and
  // the overlap stay exactly the same as before pages were tracked.
  const words: string[] = [];
  const wordPages: number[] = [];

  for (const page of pages) {
    for (const word of page.text.split(/\s+/)) {
      if (word.length === 0) continue;
      words.push(word);
      wordPages.push(page.pageNumber);
    }
  }

  const segments: TextSegment[] = [];

  let segmentIndex = 0;
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + segmentSize, words.length);
    const segmentWords = words.slice(startIndex, endIndex);
    const segmentText = segmentWords.join(' ');

    segments.push({
      text: segmentText,
      segmentIndex,
      // A segment can cross a page boundary (500-word window with 50-word
      // overlap). Rule: it is attributed to the page where it STARTS. Simple,
      // deterministic and defensible when the agent cites "en la página X".
      pageNumber: wordPages[startIndex],
      wordCount: segmentWords.length,
    });

    segmentIndex++;

    if (endIndex >= words.length) break;
    startIndex = endIndex - overlapSize;
  }

  return segments;
};
