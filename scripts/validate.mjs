#!/usr/bin/env node
// Validates everything agents read in this repository:
//   plugin.json        Agent Plugins 1.0.0 manifest schema + ChatGPT directory limits
//   mcp.json           Agent Plugins 1.0.0 MCP schema
//   .claude-plugin/    Claude Code plugin and marketplace, in step with plugin.json
//   skills/*/SKILL.md  Agent Skills frontmatter, read by a real YAML parser
//   every text file    no term from CONTENT_BLOCKLIST (customer and prospect names, internal
//                      repositories and paths) and no staff-only note (this repository is public)
// Exits non-zero on any problem.
//
// Usage: npm install && node scripts/validate.mjs
//        CONTENT_BLOCKLIST="Name One,Name Two" node scripts/validate.mjs

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const Ajv2020 = require('ajv/dist/2020').default;
const Ajv07 = require('ajv').default;
const addFormats = require('ajv-formats').default ?? require('ajv-formats');
const YAML = require('yaml');

const HOMEPAGE = 'https://relayto.com';
const MCP_URL = 'https://mcp.relayto.com/mcp';
const LICENSE_ID = 'Apache-2.0';

const problems = [];
const passed = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);
const ok = (msg) => passed.push(msg);
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const schema = (name) => readJson(`scripts/schemas/${name}`);

function check(where, data, s) {
  const draft = String(s.$schema || '');
  const ajv = draft.includes('2020-12') ? new Ajv2020({ allErrors: true, strict: false }) : new Ajv07({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(s);
  if (validate(data)) {
    ok(`${where} matches ${s.$id || s.title || 'its schema'}`);
    return;
  }
  for (const e of validate.errors) fail(where, `${e.instancePath || '/'} ${e.message}`);
}

const isHttps = (u) => {
  try {
    return new URL(u).protocol === 'https:';
  } catch {
    return false;
  }
};

function pngSize(file) {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// ---- plugin.json + mcp.json (Agent Plugins, ChatGPT directory) -------------
const plugin = readJson('plugin.json');
check('plugin.json', plugin, schema('agent-plugins-plugin.schema.1.0.0.json'));
const mcp = readJson('mcp.json');
check('mcp.json', mcp, schema('agent-plugins-mcp.schema.1.0.0.json'));
const claudePlugin = readJson('.claude-plugin/plugin.json');
const marketplace = readJson('.claude-plugin/marketplace.json');

// The two plugin manifests describe one plugin. Claude Code updates an installed plugin only
// when its version changes, so every change bumps it (CI checks that on pull requests).
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
if (!SEMVER.test(plugin.version || '')) fail('plugin.json', `version ${plugin.version} is not semver`);
if (claudePlugin.version !== plugin.version) fail('.claude-plugin/plugin.json', `version ${claudePlugin.version} != plugin.json ${plugin.version}`);
if (claudePlugin.name !== plugin.name) fail('.claude-plugin/plugin.json', `name ${claudePlugin.name} != plugin.json ${plugin.name}`);
if (!marketplace.plugins?.some((p) => p.name === plugin.name && p.source === './')) fail('.claude-plugin/marketplace.json', `does not list ${plugin.name} at ./`);
for (const [where, manifest] of [['plugin.json', plugin], ['.claude-plugin/plugin.json', claudePlugin]]) {
  if (manifest.homepage !== HOMEPAGE) fail(where, `homepage ${manifest.homepage} != ${HOMEPAGE}`);
  if (manifest.license !== LICENSE_ID) fail(where, `license ${manifest.license} != ${LICENSE_ID}`);
  if (manifest.repository !== 'https://github.com/relayto/agent-skills') fail(where, `repository ${manifest.repository} is not this repository`);
}
for (const [where, file] of [['mcp.json', mcp], ['.mcp.json', readJson('.mcp.json')]]) {
  if (!Object.values(file.mcpServers || {}).some((s) => s.url === MCP_URL)) fail(where, `does not list ${MCP_URL}`);
}
ok(`plugin ${plugin.name} ${plugin.version}: both manifests agree, both MCP files list ${MCP_URL}`);

const openai = plugin.extensions?.['com.openai'];
if (openai) {
  const ui = openai.interface || {};
  const limits = { displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80 };
  for (const [key, max] of Object.entries(limits)) {
    if (!ui[key]) fail('plugin.json', `com.openai.interface.${key} is required`);
    else if (ui[key].length > max) fail('plugin.json', `com.openai.interface.${key} is over ${max} characters`);
  }
  if (/\b(mcp|plugin)\b/i.test(ui.displayName || '')) fail('plugin.json', 'displayName must not append "MCP" or "Plugin"');
  const prompts = [].concat(ui.defaultPrompt || []);
  if (prompts.length > 3) fail('plugin.json', 'more than 3 defaultPrompt entries');
  for (const p of prompts) if (p.length > 128 || p.includes('@')) fail('plugin.json', `defaultPrompt "${p}" is too long or has an @mention`);
  for (const c of ui.capabilities || []) if (c.length > 120) fail('plugin.json', `capability "${c}" is over 120 characters`);
  if ((ui.capabilities || []).length > 20) fail('plugin.json', 'more than 20 capabilities');
  for (const key of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    if (ui[key] !== undefined && !isHttps(ui[key])) fail('plugin.json', `${key} must be https`);
  }
  for (const key of ['brandColor', 'brandColorDark']) {
    if (ui[key] !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(ui[key])) fail('plugin.json', `${key} must be #RRGGBB`);
  }
  for (const key of ['logo', 'logoDark', 'composerIcon', 'composerIconDark']) {
    if (ui[key] === undefined) continue;
    if (!ui[key].startsWith('./')) fail('plugin.json', `${key} must be a ./ path`);
    const file = join(root, ui[key]);
    if (!existsSync(file)) {
      fail('plugin.json', `${key} file ${ui[key]} is missing`);
      continue;
    }
    const size = pngSize(file);
    if (!size || size.width !== size.height || size.width < 48 || size.width > 4096) fail('plugin.json', `${key} must be a square PNG between 48 and 4096 px`);
    if (statSync(file).size > 5 * 1024 * 1024) fail('plugin.json', `${key} is over 5 MiB`);
  }
  if (openai.onboardingSkill && !existsSync(join(root, openai.onboardingSkill))) fail('plugin.json', `onboardingSkill ${openai.onboardingSkill} is missing`);
  const cases = openai.review?.test_cases;
  if (cases) {
    if ((cases.positive || []).length !== 5) fail('plugin.json', 'ChatGPT review needs exactly five positive test cases');
    if ((cases.negative || []).length !== 3) fail('plugin.json', 'ChatGPT review needs exactly three negative test cases');
  }
  ok('plugin.json com.openai listing is within the ChatGPT directory limits');
}

// ---- skills ----------------------------------------------------------------
// Parsed with a real YAML parser: `npx skills` and Claude Code use one, and a value one of them
// cannot parse (a plain scalar with ": " in it) makes the skill silently disappear there.
const skillDirs = readdirSync(join(root, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory());
const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
for (const dir of skillDirs) {
  const where = `skills/${dir.name}/SKILL.md`;
  const file = join(root, where);
  if (!existsSync(file)) {
    fail(where, 'missing');
    continue;
  }
  const m = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) {
    fail(where, 'no YAML frontmatter');
    continue;
  }
  let fm;
  try {
    fm = YAML.parse(m[1], { strict: true, uniqueKeys: true });
  } catch (e) {
    fail(where, `frontmatter is not valid YAML: ${String(e.message).split('\n')[0]}`);
    continue;
  }
  if (!fm || typeof fm !== 'object') {
    fail(where, 'frontmatter is not a mapping');
    continue;
  }
  for (const key of Object.keys(fm)) if (!allowed.has(key)) fail(where, `unknown frontmatter field ${key}`);
  const name = fm.name;
  if (typeof name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) fail(where, `name "${name}" breaks the Agent Skills name rules`);
  if (name !== dir.name) fail(where, `name "${name}" != folder "${dir.name}"`);
  if (typeof fm.description !== 'string' || !fm.description.trim() || fm.description.length > 1024) fail(where, `description must be a string of 1-1024 characters`);
  if (fm.license !== LICENSE_ID) fail(where, `license ${fm.license} != ${LICENSE_ID}`);
  if (fm.compatibility && String(fm.compatibility).length > 500) fail(where, 'compatibility is over 500 characters');
  if (fm.metadata?.homepage && fm.metadata.homepage !== HOMEPAGE) fail(where, `metadata.homepage ${fm.metadata.homepage} != ${HOMEPAGE}`);
}
ok(`${skillDirs.length} skills: frontmatter parsed as YAML and checked against the Agent Skills rules`);

// ---- public content -------------------------------------------------------------
// Terms come from the CONTENT_BLOCKLIST secret (never written here: this file is public).
const listed = (process.env.CONTENT_BLOCKLIST || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
const markers = ['RELAYTO staff', 'staff only', 'internal only'];
let files = [];
try {
  files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  fail('content scan', 'not a git checkout: cannot list the files');
}
const textFile = (f) => !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i.test(f) && f !== 'LICENSE' && f !== 'package-lock.json' && !f.startsWith('node_modules/');
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const f of files.filter(textFile)) {
  let text;
  try {
    text = readFileSync(join(root, f), 'utf8');
  } catch {
    continue;
  }
  for (const term of listed) {
    const b = (c) => (/\w/.test(c) ? '\\b' : '');
    if (new RegExp(`${b(term[0])}${escape(term)}${b(term[term.length - 1])}`, 'i').test(text)) fail(f, `has a term from CONTENT_BLOCKLIST ("${term.slice(0, 2)}…")`);
  }
  if (f !== 'scripts/validate.mjs') for (const mk of markers) if (text.toLowerCase().includes(mk.toLowerCase())) fail(f, `has an internal marker "${mk}"`);
}
ok(`content scan: ${files.filter(textFile).length} files, ${listed.length} blocklisted names${listed.length ? '' : ' (CONTENT_BLOCKLIST not set: names not checked)'}`);

// ---- report ----------------------------------------------------------------
for (const line of passed) console.log(`ok   ${line}`);
for (const line of problems) console.log(`FAIL ${line}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nall checks passed');
process.exit(problems.length ? 1 : 0);
