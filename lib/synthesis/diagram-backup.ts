import fs from 'node:fs';
import path from 'node:path';

/*
  On-disk diagram store — survives DB wipes. Every diagram save/generation writes to
  `content/diagrams/<space>/<slug>.mmd` (Mermaid text) or `.scene.json` (hand-edited Excalidraw scene).
  On a fresh DB, the seed reads these back and populates the pages.

  Keeping the diagrams alongside the markdown source makes them git-friendly and lets the wiki
  fully rehydrate from files — same rule as page content in `content/<space>/<slug>.md`.
*/

const DIAGRAMS_DIR = path.join(process.cwd(), 'content', 'diagrams');

function pathsFor(spaceSlug: string, pageSlug: string) {
  const dir = path.join(DIAGRAMS_DIR, spaceSlug);
  return {
    dir,
    mmd: path.join(dir, `${pageSlug}.mmd`),
    scene: path.join(dir, `${pageSlug}.scene.json`),
  };
}

export function saveDiagramToDisk(spaceSlug: string, pageSlug: string, diagram: string | null): void {
  if (!spaceSlug || !pageSlug) return;
  const { dir, mmd } = pathsFor(spaceSlug, pageSlug);
  fs.mkdirSync(dir, { recursive: true });
  if (diagram && diagram.trim()) {
    fs.writeFileSync(mmd, diagram);
  } else if (fs.existsSync(mmd)) {
    fs.unlinkSync(mmd);
  }
}

export function saveSceneToDisk(
  spaceSlug: string,
  pageSlug: string,
  scene: { elements: unknown[]; files?: Record<string, unknown> } | null,
): void {
  if (!spaceSlug || !pageSlug) return;
  const { dir, scene: scenePath } = pathsFor(spaceSlug, pageSlug);
  fs.mkdirSync(dir, { recursive: true });
  if (scene) {
    fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2));
  } else if (fs.existsSync(scenePath)) {
    fs.unlinkSync(scenePath);
  }
}

export function readDiagramFromDisk(spaceSlug: string, pageSlug: string): string | null {
  const { mmd } = pathsFor(spaceSlug, pageSlug);
  if (!fs.existsSync(mmd)) return null;
  const text = fs.readFileSync(mmd, 'utf8').trim();
  return text || null;
}

export function readSceneFromDisk(
  spaceSlug: string,
  pageSlug: string,
): { elements: unknown[]; files?: Record<string, unknown> } | null {
  const { scene } = pathsFor(spaceSlug, pageSlug);
  if (!fs.existsSync(scene)) return null;
  try {
    return JSON.parse(fs.readFileSync(scene, 'utf8'));
  } catch {
    return null;
  }
}

export function listDiagramsOnDisk(): Array<{ spaceSlug: string; pageSlug: string; diagram: string | null; scene: any }> {
  if (!fs.existsSync(DIAGRAMS_DIR)) return [];
  const out: Array<{ spaceSlug: string; pageSlug: string; diagram: string | null; scene: any }> = [];
  for (const spaceSlug of fs.readdirSync(DIAGRAMS_DIR)) {
    const spaceDir = path.join(DIAGRAMS_DIR, spaceSlug);
    if (!fs.statSync(spaceDir).isDirectory()) continue;
    const slugSet = new Set<string>();
    for (const f of fs.readdirSync(spaceDir)) {
      if (f.endsWith('.mmd')) slugSet.add(f.slice(0, -4));
      else if (f.endsWith('.scene.json')) slugSet.add(f.slice(0, -11));
    }
    for (const pageSlug of slugSet) {
      out.push({
        spaceSlug,
        pageSlug,
        diagram: readDiagramFromDisk(spaceSlug, pageSlug),
        scene: readSceneFromDisk(spaceSlug, pageSlug),
      });
    }
  }
  return out;
}
