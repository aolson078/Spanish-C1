import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertImportSize, buildDatabaseFromTransfer, createExportDocument, fingerprintRepository, maximumImportBytes, parseTransferBytes, PortableTransferError } from '../src/portable-transfer.js';
import { SpanishC1Repository } from '../src/repository.js';
import { session } from './fixtures.js';
import { createTestDataRoot, removeTestDataRoot } from './test-root.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) removeTestDataRoot(root); });

describe('portable JSON transfer', () => {
  it.each([1, 2] as const)('round-trips format v%s through a staged database while retaining the receiving data root', (formatVersion) => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using source = new SpanishC1Repository(paths.database);
    source.saveSession(session);
    source.setSetting('activeDataRoot', 'D:\\old-location');
    const current = createExportDocument(source, '2026-08-25T12:00:00.000Z');
    const document = formatVersion === 1
      ? { formatVersion: 1 as const, exportedAt: current.exportedAt, data: current.data }
      : current;
    const parsed = parseTransferBytes(Buffer.from(JSON.stringify(document)));
    const destination = path.join(paths.root, `import-v${formatVersion}.sqlite`);

    buildDatabaseFromTransfer(parsed, destination, paths.root);

    using imported = new SpanishC1Repository(destination);
    expect(imported.getSession(session.id)).toEqual(session);
    expect(imported.getSetting('activeDataRoot')).toBe(paths.root);
  });

  it.each([
    { label: 'unknown version', mutate: (document: Record<string, unknown>) => ({ ...document, formatVersion: 9 }) },
    { label: 'unsupported application version', mutate: (document: Record<string, unknown>) => ({ ...document, applicationVersion: '0.3.0' }) },
    { label: 'unknown table', mutate: (document: Record<string, unknown>) => ({ ...document, data: { ...(document.data as object), surprise: [] } }) },
    { label: 'missing table', mutate: (document: Record<string, unknown>) => { const data = { ...(document.data as Record<string, unknown>) }; delete data.reviews; return { ...document, data }; } },
  ])('rejects $label', ({ mutate }) => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const raw = mutate(createExportDocument(repository) as unknown as Record<string, unknown>);
    expect(() => parseTransferBytes(Buffer.from(JSON.stringify(raw)))).toThrow(PortableTransferError);
  });

  it.each([
    ['malformed JSON', Buffer.from('{')],
    ['unknown column', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: '2026-08-25T12:00:00.000Z', data: {
      sessions: [], session_progress: [], weaknesses: [], evidence_events: [], weakness_control_events: [], reviews: [], assessments: [],
      settings: [{ key: 'bad', value_json: 'true', updated_at: '2026-08-25T12:00:00.000Z', surprise: true }],
    } }))],
    ['invalid date', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: '2026-02-30T12:00:00.000Z', data: {
      sessions: [], session_progress: [], weaknesses: [], evidence_events: [], weakness_control_events: [], reviews: [], settings: [], assessments: [],
    } }))],
    ['invalid JSON field', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: '2026-08-25T12:00:00.000Z', data: {
      sessions: [], session_progress: [], weaknesses: [], evidence_events: [], weakness_control_events: [], reviews: [], assessments: [],
      settings: [{ key: 'bad', value_json: '{', updated_at: '2026-08-25T12:00:00.000Z' }],
    } }))],
    ['invalid nullable row date', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: '2026-08-25T12:00:00.000Z', data: {
      sessions: [{ id: 'session-bad-date', mode: 'normal', status: 'completed', started_at: '2026-08-25T12:00:00.000Z', completed_at: 'tomorrow', summary: null }],
      session_progress: [], weaknesses: [], evidence_events: [], weakness_control_events: [], reviews: [], settings: [], assessments: [],
    } }))],
    ['structurally invalid nested JSON', Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: '2026-08-25T12:00:00.000Z', data: {
      sessions: [], session_progress: [], evidence_events: [], weakness_control_events: [], reviews: [], settings: [], assessments: [],
      weaknesses: [{
        id: 'weakness-bad-json', category: 'grammar', feature_key: 'feature', state: 'suspected', confidence: 0.5,
        severity: 2, communicative_impact: 2, first_detected_at: '2026-08-25T12:00:00.000Z', last_observed_at: '2026-08-25T12:00:00.000Z',
        recurrence_count: 0, source_activity_id: 'activity', next_review_at: null, reference_ids_json: '{}', mexican_notes_json: '[]', revision: 1, is_paused: 0,
      }],
    } }))],
  ])('rejects %s', (_label, bytes) => {
    expect(() => parseTransferBytes(bytes)).toThrow(PortableTransferError);
  });

  it('rejects oversized input from its bounded byte count without allocating the payload', () => {
    expect(() => assertImportSize(maximumImportBytes + 1)).toThrow('256 MiB');
  });

  it('rejects broken foreign keys without modifying the source database', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const document = createExportDocument(repository);
    const broken = parseTransferBytes(Buffer.from(JSON.stringify({
      ...document,
      data: { ...document.data, reviews: [{ id: 'review-broken', weakness_id: 'missing', due_at: '2026-08-25T12:00:00.000Z', completed_at: null, outcome: null }] },
    })));
    expect(() => buildDatabaseFromTransfer(broken, path.join(paths.root, 'broken.sqlite'), paths.root)).toThrow('could not be loaded');
    expect(repository.listSessions()).toEqual([]);
  });

  it('rejects duplicate primary identifiers while staging', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);
    const document = createExportDocument(repository);
    const duplicate = parseTransferBytes(Buffer.from(JSON.stringify({
      ...document,
      data: { ...document.data, sessions: [document.data.sessions[0], document.data.sessions[0]] },
    })));
    expect(() => buildDatabaseFromTransfer(duplicate, path.join(paths.root, 'duplicate.sqlite'), paths.root)).toThrow('could not be loaded');
  });

  it('preserves a recognized older-rubric assessment envelope for incompatible-history reporting', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const document = createExportDocument(repository);
    const parsed = parseTransferBytes(Buffer.from(JSON.stringify({
      ...document,
      data: { ...document.data, assessments: [{
        id: 'assessment-legacy', kind: 'baseline', status: 'active', started_at: '2026-08-25T12:00:00.000Z', completed_at: null,
        profile_json: JSON.stringify({ type: 'progress', progress: { rubricVersion: 'practical-c1-text.v1', preserved: true } }), revision: 1,
      }] },
    })));
    const destination = path.join(paths.root, 'legacy-assessment.sqlite');

    buildDatabaseFromTransfer(parsed, destination, paths.root);

    using imported = new SpanishC1Repository(destination);
    expect(imported.getAssessment('assessment-legacy')?.profile).toMatchObject({ progress: { rubricVersion: 'practical-c1-text.v1' } });
  });

  it('produces a stable logical fingerprint independent of insertion order', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const first = path.join(paths.root, 'first.sqlite');
    const second = path.join(paths.root, 'second.sqlite');
    using left = new SpanishC1Repository(first);
    using right = new SpanishC1Repository(second);
    left.setSetting('b', 2, '2026-08-25T12:00:00.000Z'); left.setSetting('a', 1, '2026-08-25T12:00:00.000Z');
    right.setSetting('a', 1, '2026-08-25T12:00:00.000Z'); right.setSetting('b', 2, '2026-08-25T12:00:00.000Z');
    expect(fingerprintRepository(left)).toBe(fingerprintRepository(right));
  });
});
