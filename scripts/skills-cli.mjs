#!/usr/bin/env node
// Checks that the `skills` CLI (npx skills, the one skills.sh lists installs from) finds every
// folder in skills/. A skill it cannot read is skipped without an error, so count them.
//
// Usage: node scripts/skills-cli.mjs   (needs network for npx; telemetry is turned off)
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const expected = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
const out = execFileSync('npx', ['-y', 'skills', 'add', '.', '--list'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', CI: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 180000,
});
const text = out.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
const found = expected.filter((name) => new RegExp(`(^|\\s)${name}(\\s|$)`, 'm').test(text));
const missing = expected.filter((name) => !found.includes(name));
if (missing.length) {
  console.log(`FAIL npx skills does not find: ${missing.join(', ')} (check their frontmatter)`);
  process.exit(1);
}
console.log(`ok   npx skills finds all ${expected.length} skills: ${expected.join(', ')}`);
