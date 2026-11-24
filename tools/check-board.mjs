// A standalone check of a built board, for development: it reads the /output directory main.ts
// wrote and applies the gate's own file rules to it, without the server. It checks board.json's
// shape and caps, the dashboard's source cap, the screenshots' count, names, dimensions and byte
// caps, and the dossier's size cap. It takes the output directory as its one argument, or /output.
//
//   node tools/check-board.mjs out
//
// It exits 0 when every rule holds and 1 with the first failure on stderr. It never writes.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2] ?? '/output';
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_MAX_BYTES = 524_288;
const BOARD_MAX_ROWS = 4_000;
const BOARD_MAX_BYTES = 8_388_608;
const DOSSIER_MAX_BYTES = 1_572_864;
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function fail(message) {
  process.stderr.write(`check-board: ${message}\n`);
  process.exit(1);
}

function pngSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 33 || bytes[0] !== 0x89 || bytes.toString('latin1', 1, 4) !== 'PNG') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(file) {
  const bytes = readFileSync(file);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1];
    const length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    }
    at += 2 + length;
  }
  return null;
}

if (!existsSync(join(out, 'board.json'))) fail(`no board.json in ${out}: run main.ts first`);
const boardText = readFileSync(join(out, 'board.json'), 'utf8');
if (Buffer.byteLength(boardText, 'utf8') > BOARD_MAX_BYTES) {
  fail(`board.json is over the ${BOARD_MAX_BYTES} byte cap`);
}
let board;
try {
  board = JSON.parse(boardText);
} catch {
  fail('board.json is not JSON');
}
const rows = Array.isArray(board) ? board : board.rows;
if (!Array.isArray(rows)) fail('board.json holds no rows array');
if (rows.length < 100 || rows.length > BOARD_MAX_ROWS) {
  fail(`the board holds ${rows.length} rows: the gate takes 100 to ${BOARD_MAX_ROWS}`);
}
const slugs = new Set();
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (typeof r.slug !== 'string' || r.slug.length === 0) fail(`row ${i + 1} has no slug`);
  if (slugs.has(r.slug)) fail(`slug ${r.slug} appears twice`);
  slugs.add(r.slug);
  if (r.rank !== i + 1) fail(`row ${i + 1} has rank ${r.rank}`);
  if (i > 0 && r.implied_value_usd > rows[i - 1].implied_value_usd) {
    fail(`row ${i + 1} outranks row ${i} on implied value`);
  }
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) {
    fail(`${r.slug} has implied value ${r.implied_value_usd}`);
  }
  if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
    fail(`${r.slug} has ${Array.isArray(r.farm_steps) ? r.farm_steps.length : 'no'} farm steps`);
  }
  for (const s of r.farm_steps) {
    if (typeof s !== 'string' || s.trim().length < 20 || s.trim().length > 600) {
      fail(`${r.slug} has a farm step of ${typeof s === 'string' ? s.trim().length : 'no'} characters`);
    }
  }
}

const dashboardDir = join(out, 'dashboard');
if (!existsSync(join(dashboardDir, 'index.html'))) fail('dashboard/ holds no index.html');
const dashboardFiles = readdirSync(dashboardDir).filter((n) => !n.startsWith('.'));
const dashboardBytes = dashboardFiles.reduce((sum, n) => sum + statSync(join(dashboardDir, n)).size, 0);
if (dashboardBytes > TEXT_MAX_BYTES) {
  fail(`dashboard/ is ${dashboardBytes} bytes: the dossier's text cap is ${TEXT_MAX_BYTES}`);
}
const css = dashboardFiles.filter((n) => n.endsWith('.css'));
const js = dashboardFiles.filter((n) => n.endsWith('.js'));
if (css.length === 0 || js.length === 0) fail('dashboard/ needs at least one .css and one .js file');

const shotsDir = join(out, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((n) => !n.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ holds ${shots.length} images: the gate takes 3 or 4`);
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a bad name`);
  const file = join(shotsDir, name);
  const size = statSync(file).size;
  if (size > SCREENSHOT_MAX_BYTES) fail(`screenshots/${name} is ${size} bytes: the cap is ${SCREENSHOT_MAX_BYTES}`);
  const dims = pngSize(file) ?? jpegSize(file);
  if (dims === null) fail(`screenshots/${name} is neither a whole PNG nor a whole JPEG`);
  if (Math.max(dims.width, dims.height) > 1440 || Math.min(dims.width, dims.height) < 800) {
    fail(`screenshots/${name} is ${dims.width}x${dims.height}: the long side is at most 1440, the short side at least 800`);
  }
}

const dossier = join(out, 'dossier.json');
if (!existsSync(dossier)) fail('no dossier.json in the output: run main.ts first');
if (statSync(dossier).size > DOSSIER_MAX_BYTES) fail(`dossier.json is over the ${DOSSIER_MAX_BYTES} byte cap`);

process.stdout.write(
  `check-board: ${rows.length} rows, ${dashboardFiles.length} dashboard files (${dashboardBytes} bytes), ${shots.length} screenshots, dossier ${statSync(dossier).size} bytes: all gate file rules hold\n`,
);
