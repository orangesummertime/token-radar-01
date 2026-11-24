// Token Radar's radar-2 entry (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), scores every
// pre-token protocol with the model in lib/model.ts, writes the ranked board to /output/board.json, and
// copies this repository's dashboard/ and screenshots/ to /output. Last, it writes /output/dossier.json,
// the summary the judge reads, with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network: dashboard/index.html, dashboard/app.css
// and dashboard/app.js read /output/data.js, which this program writes from the same board. Radar-2:
// the model prices each category from the snapshot's own live-token market-cap-to-TVL medians, adds
// a chain-breadth premium, and ranks every rankable pre-token protocol, watchlist and early alike.
//
// Before it writes the dossier it checks the gate's own caps itself: the dashboard's source stays
// under the dossier's text cap, every screenshot stays under its byte cap, and the board stays
// inside its row cap. A run that would hand in files the gate refuses stops here, with the reason,
// instead of failing on the server.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
/** The gate's board cap, from RULES.txt: 100 to 4,000 rows, at most 8 MiB of board.json. */
const BOARD_MAX_ROWS = 4_000;
const BOARD_MAX_BYTES = 8_388_608;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

/** A failure the run stops on, with the reason on stderr and exit code 1. */
function fail(message: string): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(1);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);
if (board.length < 100 || board.length > BOARD_MAX_ROWS) {
  fail(`the board holds ${board.length} rows: the gate takes 100 to ${BOARD_MAX_ROWS}`);
}

mkdirSync(out, { recursive: true });
const boardText = `${JSON.stringify({ rows: board })}\n`;
if (Buffer.byteLength(boardText, 'utf8') > BOARD_MAX_BYTES) {
  fail(`board.json is ${Buffer.byteLength(boardText, 'utf8')} bytes: the gate takes at most ${BOARD_MAX_BYTES}`);
}
writeFileSync(join(out, 'board.json'), boardText);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const dashboardBytes = dashboardFiles.reduce((sum, name) => sum + statSync(join(out, 'dashboard', name)).size, 0);
if (dashboardBytes > TEXT_MAX_BYTES) {
  fail(`dashboard/ is ${dashboardBytes} bytes: the dossier's text cap is ${TEXT_MAX_BYTES}, so the judge would read a partial page`);
}
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  }
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > SCREENSHOT_CAPS.max_bytes) {
    fail(`screenshots/${name} is ${size} bytes: the gate takes at most ${SCREENSHOT_CAPS.max_bytes} per image`);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

/** The board's best row per category, for the run log: the category, its rows and its leader. */
function categoryLeaders(): string[] {
  const best = new Map<string, { count: number; name: string; implied: number }>();
  for (const row of board) {
    const key = row.category ?? 'Other';
    const hit = best.get(key);
    if (hit === undefined) best.set(key, { count: 1, name: row.name, implied: row.implied_value_usd });
    else hit.count += 1;
  }
  return [...best.entries()]
    .sort((a, b) => b[1].implied - a[1].implied)
    .slice(0, 5)
    .map(([category, hit]) => `${category} (${hit.count} rows, best ${hit.name} $${hit.implied.toLocaleString('en-US')})`);
}

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files, ${dashboardBytes} bytes), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n` +
    `token radar: leading categories: ${categoryLeaders().join('; ')}\n`,
);
