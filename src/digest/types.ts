export type RunStatus = 'ok' | 'retry' | 'fail';

/** One line of runs/<night>.jsonl. A line that doesn't parse into this is a bad line. */
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

/** One job of the night. "First" and "last" follow line order in the file. */
export type DigestRow = {
  job: string;
  /** From the job's last line; null renders as `—`. */
  owner: string | null;
  /** The job's lines, any status, retries included. */
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  /** The job's latest `error`, kept even when a later line is `ok`. */
  lastError: string | null;
  /** `at` as written in the log, offset kept, never converted to UTC. */
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  /** Sorted by job (plain string order). The page and the JSON use this order as is. */
  rows: DigestRow[];
  /** Non-blank lines that don't parse into a RunLine. They are in no row and no count. */
  badLines: number;
  counts: Record<RunStatus, number>;
};

/**
 * Implemented as `readNight` in ./readNight.ts. Returns null when `<runsDir>/<night>.jsonl`
 * doesn't exist or `night` isn't YYYY-MM-DD, so a route can never read outside runsDir.
 * An empty file is a Night with no rows ("nothing ran"), never null.
 */
export type ReadNight = (runsDir: string, night: string) => Night | null;
