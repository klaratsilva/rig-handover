import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-10-20';
const EMPTY = '2026-10-21';
const BAD = '2026-10-22';
const MISSING = '2026-10-23';
const NOT_A_DATE = 'not-a-night';

const line = (job: string, status: 'ok' | 'retry' | 'fail', owner: string | null, at: string, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

const normalLines = [
  line('zeta/cleanup', 'ok', 'rook', '2026-10-20T23:00:00+01:00'),
  line('alpha/sync', 'retry', 'rook', '2026-10-20T23:10:00+01:00', 'upstream 503'),
  line('mid/build', 'fail', null, '2026-10-20T23:20:00+01:00', 'exit 1'),
  line('alpha/sync', 'ok', 'rook', '2026-10-20T23:30:00+01:00'),
];
const expectedJobs = ['alpha/sync', 'mid/build', 'zeta/cleanup'];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${NORMAL}.jsonl`), normalLines.join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [normalLines[0], 'this is not json', normalLines[1]].join('\n') + '\n',
  );
  app = createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

const order = (html: string, jobs: string[]) =>
  jobs.map((job) => ({ job, at: html.indexOf(job) })).sort((a, b) => a.at - b.at).map((x) => x.job);

describe('GET /digest/:night', () => {
  it('lists every job of a normal night, sorted by job', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of expectedJobs) expect(html).toContain(job);
    expect(order(html, expectedJobs)).toEqual(expectedJobs);
  });

  it('404s with the night named when there is no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING}`);
  });

  it('404s for an id that is not a date', async () => {
    const res = await app.request(`/digest/${NOT_A_DATE}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${NOT_A_DATE}`);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the good rows when a line is bad', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('zeta/cleanup');
    expect(html).toContain('alpha/sync');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON with rows sorted by job', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const night: Night = await res.json();
    expect(night.night).toBe(NORMAL);
    expect(night.rows.map((r) => r.job)).toEqual(expectedJobs);
    expect(night.badLines).toBe(0);
  });

  it('404s with an error body when there is no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no run log for ${MISSING}` });
  });

  it('404s for an id that is not a date', async () => {
    const res = await app.request(`/api/digest/${NOT_A_DATE}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no run log for ${NOT_A_DATE}` });
  });

  it('returns no rows for an empty file', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const night: Night = await res.json();
    expect(night.rows).toEqual([]);
    expect(night.badLines).toBe(0);
  });

  it('counts the bad line and keeps the good rows', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const night: Night = await res.json();
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['alpha/sync', 'zeta/cleanup']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request(`/digest/${NORMAL}`)).text();
    const night: Night = await (await app.request(`/api/digest/${NORMAL}`)).json();
    const jobs = night.rows.map((r) => r.job);
    expect(jobs).toHaveLength(expectedJobs.length);
    expect(order(html, jobs)).toEqual(jobs);
  });
});
