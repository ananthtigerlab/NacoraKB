import 'server-only';
import path from 'node:path';
import fs from 'node:fs';
import simpleGit, { SimpleGit } from 'simple-git';

// Local, read-only git access to the InSurance repo. NEVER writes back.

export function getRepoPath(): string {
  const p = process.env.NACORA_CODE_PATH;
  if (!p) throw new Error('NACORA_CODE_PATH not set — see .env.example');
  if (!fs.existsSync(p)) throw new Error(`NACORA_CODE_PATH does not exist: ${p}`);
  return p;
}

let _git: SimpleGit | null = null;
export function repo(): SimpleGit {
  if (!_git) _git = simpleGit(getRepoPath(), { binary: 'git' });
  return _git;
}

export type PathSpec = { primary: string[]; shared: string[]; ignore: string[] };

let _spec: PathSpec | null = null;
export function loadPathSpec(): PathSpec {
  if (_spec) return _spec;
  const cfgPath = path.join(process.cwd(), 'nacora.paths.json');
  const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  _spec = {
    primary: [
      ...(raw.primary?.backend ?? []),
      ...(raw.primary?.frontend ?? []),
    ],
    shared: raw.shared?.paths ?? [],
    ignore: raw.ignore ?? [],
  };
  return _spec;
}

export async function currentHead(): Promise<string> {
  const { latest } = await repo().log({ maxCount: 1 });
  return latest?.hash ?? '';
}

// Return files that changed between two commits, filtered to Nacora scope + shared paths.
export async function changedFiles(fromRef: string | null, toRef: string): Promise<Array<{ path: string; scope: 'primary' | 'shared'; status: string }>> {
  const spec = loadPathSpec();
  const range = fromRef ? `${fromRef}..${toRef}` : toRef;
  const raw = await repo().raw(['diff', '--name-status', range]);
  const rows = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split(/\s+/);
      return { status, path: rest.join(' ') };
    });

  const results: Array<{ path: string; scope: 'primary' | 'shared'; status: string }> = [];
  for (const r of rows) {
    if (spec.ignore.some((pattern) => matchesGlob(r.path, pattern))) continue;
    if (spec.primary.some((p) => r.path.startsWith(p))) {
      results.push({ path: r.path, status: r.status, scope: 'primary' });
    } else if (spec.shared.some((p) => r.path.startsWith(p))) {
      results.push({ path: r.path, status: r.status, scope: 'shared' });
    }
  }
  return results;
}

// Get file content at a given ref — used to feed the synthesiser.
export async function fileAtRef(filePath: string, ref: string): Promise<string> {
  try {
    return await repo().show([`${ref}:${filePath}`]);
  } catch {
    return '';
  }
}

// Cheap glob matcher for the small patterns in nacora.paths.json ("**/x/**", "**/*.pyc").
function matchesGlob(p: string, pat: string): boolean {
  const re = new RegExp(
    '^' +
      pat
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*') +
      '$',
  );
  return re.test(p);
}

// Read all Nacora-scoped source files at HEAD for the initial synthesis run.
export async function listScopedFilesAtHead(): Promise<Array<{ path: string; scope: 'primary' | 'shared' }>> {
  const spec = loadPathSpec();
  const raw = await repo().raw(['ls-tree', '-r', '--name-only', 'HEAD']);
  const out: Array<{ path: string; scope: 'primary' | 'shared' }> = [];
  for (const line of raw.split('\n')) {
    const p = line.trim();
    if (!p) continue;
    if (spec.ignore.some((pat) => matchesGlob(p, pat))) continue;
    if (spec.primary.some((prefix) => p.startsWith(prefix))) out.push({ path: p, scope: 'primary' });
    else if (spec.shared.some((prefix) => p.startsWith(prefix))) out.push({ path: p, scope: 'shared' });
  }
  return out;
}
