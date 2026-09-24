import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    mergeAdjacentTranscriptMessage,
    mergeTranscriptFragments,
} from './transcript.ts';

describe('mergeTranscriptFragments', () => {
    it('joins separate final chunks from one utterance', () => {
        assert.equal(
            mergeTranscriptFragments('Mi investigación utiliza', 'un agente RAG.'),
            'Mi investigación utiliza un agente RAG.',
        );
    });

    it('uses the newest cumulative transcript without duplicating its prefix', () => {
        assert.equal(
            mergeTranscriptFragments('Mi investigación', 'Mi investigación utiliza RAG.'),
            'Mi investigación utiliza RAG.',
        );
    });

    it('removes overlap between consecutive chunks', () => {
        assert.equal(
            mergeTranscriptFragments('El objetivo es mejorar la preparación', 'la preparación del estudiante.'),
            'El objetivo es mejorar la preparación del estudiante.',
        );
    });
});

describe('mergeAdjacentTranscriptMessage', () => {
    it('keeps consecutive chunks from the same speaker in one message', () => {
        assert.deepEqual(
            mergeAdjacentTranscriptMessage(
                [{ role: 'user', content: 'Bueno, mi tesis' }],
                { role: 'user', content: 'usa recuperación aumentada.' },
            ),
            [{ role: 'user', content: 'Bueno, mi tesis usa recuperación aumentada.' }],
        );
    });

    it('starts a new message when the speaker changes', () => {
        assert.equal(
            mergeAdjacentTranscriptMessage(
                [{ role: 'user', content: 'Mi respuesta.' }],
                { role: 'assistant', content: 'Entiendo.' },
            ).length,
            2,
        );
    });
});
