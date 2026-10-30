import type { DigestRow, Night } from '../digest/types.js';

const MISSING = '—';
const RETRY_MARK = 3;

function isMarked(row: DigestRow) {
  return row.retries >= RETRY_MARK || row.lastStatus === 'fail';
}

export function DigestPage({ night }: { night: Night }) {
  return (
    <>
      <h1>{night.night}</h1>
      {night.badLines > 0 && (
        <p class="warn">
          {night.badLines} {night.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      )}
      {night.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {night.rows.map((row) => (
              <tr class={isMarked(row) ? 'warn' : undefined}>
                <td>{row.job || MISSING}</td>
                <td>{row.owner || MISSING}</td>
                <td>{row.runs}</td>
                <td>{row.retries}</td>
                <td>{row.lastStatus}</td>
                <td>{row.lastError || MISSING}</td>
                <td>{row.firstAt || MISSING}</td>
                <td>{row.lastAt || MISSING}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function DigestNotFound({ night }: { night: string }) {
  return <p class="mute">no run log for {night}</p>;
}
