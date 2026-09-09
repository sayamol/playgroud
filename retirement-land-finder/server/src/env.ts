/**
 * Minimal .env loader (no dependency). Looks for a .env file at the
 * project root and in server/. Existing process.env values win.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  join(here, '..', '..', '.env'), // project root
  join(here, '..', '.env'), // server/.env
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
