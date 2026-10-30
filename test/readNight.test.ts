import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('reads one row per job, sorted by job', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts the truncated last line as bad instead of throwing', () => {
    expect(night?.badLines).toBe(1);
  });

  it('counts the parsed lines per status', () => {
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('sums runs and retries and keeps the latest error after a later ok', () => {
    expect(row('fixtures/refresh')).toMatchObject({
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
    });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1 });
  });

  it("keeps the log's offset on the first and last time", () => {
    expect(row('lane/sync')).toMatchObject({
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight on a temp runs dir', () => {
  let root: string;
  let runsDir: string;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    runsDir = join(root, 'runs');
    mkdirSync(runsDir);
    writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
    writeFileSync(
      join(root, 'outside.jsonl'),
      '{"at":"2026-10-30T01:00:00+01:00","job":"x","status":"ok","owner":null}\n',
    );
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads an empty file as a night where nothing ran', () => {
    expect(readNight(runsDir, '2026-10-30')).toEqual({
      night: '2026-10-30',
      rows: [],
      badLines: 0,
      counts: { ok: 0, retry: 0, fail: 0 },
    });
  });

  it('returns null for a night with no file', () => {
    expect(readNight(runsDir, '2026-10-31')).toBeNull();
  });

  it('returns null for a night id that is not YYYY-MM-DD', () => {
    expect(readNight(runsDir, '../outside')).toBeNull();
  });
});
