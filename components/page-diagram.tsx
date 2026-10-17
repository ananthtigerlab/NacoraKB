'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles, AlertTriangle, Pencil, Check, X, PencilRuler } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import '@excalidraw/excalidraw/index.css';

// Excalidraw + mermaid-to-excalidraw both touch `document` on import.
// Load client-only so SSR doesn't crash.
const Excalidraw = dynamic<any>(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw as any,
  { ssr: false, loading: () => <DiagramFrame><CanvasSkeleton label="Loading canvas…" /></DiagramFrame> },
);

type SceneJSON = { elements: unknown[]; files?: Record<string, unknown> };

type Props = {
  pageId: string;
  diagram: string | null | undefined;
  diagramScene?: SceneJSON | null;
  canRegenerate?: boolean;
};

type LocalScene = { elements: readonly any[]; files: Record<string, any> | undefined };

const STORAGE_PREFIX = 'nacora.diagram.open.';
const VIEW_HEIGHT = 380;
const EDIT_HEIGHT = 640;

export function PageDiagram({ pageId, diagram: initialDiagram, diagramScene: initialScene, canRegenerate = true }: Props) {
  const [diagram, setDiagram] = React.useState<string | null>(initialDiagram ?? null);
  const [savedScene, setSavedScene] = React.useState<SceneJSON | null>(initialScene ?? null);
  const [open, setOpen] = React.useState(true);
  const [scene, setScene] = React.useState<LocalScene | null>(null);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [converting, setConverting] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const excalidrawRef = React.useRef<any>(null);
  const isEdited = savedScene !== null;

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_PREFIX + pageId);
    if (stored !== null) setOpen(stored === '1');
  }, [pageId]);

  React.useEffect(() => {
    setDiagram(initialDiagram ?? null);
    setSavedScene(initialScene ?? null);
  }, [initialDiagram, initialScene]);

  // Convert Mermaid → scene, or restore saved scene, whenever inputs change.
  React.useEffect(() => {
    if (!open) { setScene(null); return; }
    let cancelled = false;

    // If we have a saved hand-edited scene, use it directly — no Mermaid conversion.
    if (savedScene) {
      setScene({ elements: (savedScene.elements as any[]) ?? [], files: (savedScene.files as any) ?? {} });
      setRenderError(null);
      return () => { cancelled = true; };
    }

    if (!diagram || !diagram.trim()) { setScene(null); setRenderError(null); return; }

    setConverting(true);
    setRenderError(null);
    (async () => {
      try {
        const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
        const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw');
        const result = await parseMermaidToExcalidraw(diagram.trim());
        if (cancelled) return;
        const rawElements = convertToExcalidrawElements(result.elements as any);
        // mermaid-to-excalidraw sizes containers using Mermaid's sans-serif metrics but Excalidraw
        // renders in Virgil (the sketchy hand-drawn font), which is wider — labels overflow
        // the box on both sides. Pad every container that has bound text.
        const elements = padContainersForVirgil(rawElements as any[]);
        setScene({ elements, files: result.files });
      } catch (e) {
        if (!cancelled) setRenderError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setConverting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagram, savedScene, open]);

  function toggle() {
    if (editing) return;                                    // don't collapse while editing
    const next = !open;
    setOpen(next);
    localStorage.setItem(STORAGE_PREFIX + pageId, next ? '1' : '0');
  }

  async function regenerate() {
    if (regenerating) return;
    if (isEdited) {
      const ok = window.confirm(
        'This diagram was manually edited. Regenerating will replace your edits with a fresh LLM version. Continue?',
      );
      if (!ok) return;
    }
    setRegenerating(true);
    try {
      const url = isEdited ? `/api/pages/${pageId}/diagram?force=1` : `/api/pages/${pageId}/diagram`;
      const res = await fetch(url, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      setDiagram(body.diagram);
      setSavedScene(null);
      toast({ title: 'Diagram regenerated', variant: 'success' });
    } catch (e) {
      toast({ title: 'Regenerate failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setRegenerating(false);
    }
  }

  function enterEdit() {
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    // Force a re-render of the canvas from the last saved state so any in-canvas changes are dropped
    if (savedScene) setScene({ elements: (savedScene.elements as any[]) ?? [], files: (savedScene.files as any) ?? {} });
  }

  async function saveEdit() {
    if (!excalidrawRef.current || saving) return;
    setSaving(true);
    try {
      const elements = excalidrawRef.current.getSceneElements() as unknown[];
      const files = excalidrawRef.current.getFiles?.() ?? {};
      const scenePayload: SceneJSON = { elements, files };
      const res = await fetch(`/api/pages/${pageId}/diagram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_scene: scenePayload }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedScene(scenePayload);
      setEditing(false);
      toast({ title: 'Diagram saved', variant: 'success' });
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function revertToLlm() {
    if (!isEdited) return;
    const ok = window.confirm('Discard your manual edits and go back to the auto-generated diagram?');
    if (!ok) return;
    try {
      const res = await fetch(`/api/pages/${pageId}/diagram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagram_scene: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedScene(null);
      setEditing(false);
      toast({ title: 'Reverted to auto-generated diagram', variant: 'success' });
    } catch (e) {
      toast({ title: 'Revert failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  }

  const nothingToShow = !diagram && !savedScene;
  if (nothingToShow) {
    if (!canRegenerate) return null;
    return (
      <div className="mb-6 flex items-center justify-between rounded-md border border-dashed border-border-muted px-3 py-2 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-text-subtle" />
          No diagram yet for this page.
        </span>
        <button
          onClick={regenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5 hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Generate
        </button>
      </div>
    );
  }

  const frameHeight = editing ? EDIT_HEIGHT : VIEW_HEIGHT;

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex w-full items-center justify-between gap-2 px-4 py-2">
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-center gap-2 text-left hover:bg-surface-muted/40"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <Sparkles className="h-3.5 w-3.5" />
            Diagram
          </span>
          {isEdited && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
              <PencilRuler className="h-3 w-3" />
              manually edited
            </span>
          )}
        </button>
        <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
          {converting && (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> rendering</span>
          )}
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded border border-primary bg-primary px-2 py-0.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Save
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5 text-text-muted hover:border-danger hover:text-danger"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={enterEdit}
                disabled={!scene || Boolean(renderError)}
                className="inline-flex items-center gap-1 rounded border border-border-muted bg-surface px-2 py-0.5 text-text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                aria-label="Edit diagram"
              >
                <Pencil className="h-3 w-3" />
                edit
              </button>
              {isEdited && (
                <button
                  onClick={revertToLlm}
                  className="inline-flex items-center gap-1 rounded border border-border-muted bg-surface px-2 py-0.5 text-text-muted hover:border-warning hover:text-warning"
                  aria-label="Revert to auto-generated"
                  title="Revert to auto-generated"
                >
                  revert
                </button>
              )}
              {canRegenerate && (
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1 rounded border border-border-muted bg-surface px-2 py-0.5 text-text-muted hover:border-primary hover:text-primary disabled:opacity-40"
                  aria-label="Regenerate diagram"
                >
                  {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  regenerate
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {open && (
        <div className="border-t border-border-muted bg-surface-muted/20 p-3">
          {renderError ? (
            <div className="rounded border border-warning/40 bg-warning/5 p-3 text-xs text-text">
              <div className="mb-1 flex items-center gap-1 font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Couldn't render diagram
              </div>
              <div className="text-text-muted">{renderError}</div>
              <details className="mt-2">
                <summary className="cursor-pointer text-text-subtle">show source</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-surface p-2 text-[11px]">{diagram}</pre>
              </details>
              {canRegenerate && (
                <button
                  onClick={regenerate}
                  disabled={regenerating}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-border bg-surface px-2 py-0.5 text-xs hover:border-primary hover:text-primary"
                >
                  {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Try again
                </button>
              )}
            </div>
          ) : scene ? (
            <DiagramFrame height={frameHeight}>
              <Excalidraw
                key={`${pageId}:${editing ? 'edit' : 'view'}:${isEdited ? 'saved' : 'llm'}`}
                excalidrawAPI={(api: any) => { excalidrawRef.current = api; }}
                initialData={{
                  elements: scene.elements as any,
                  files: scene.files as any,
                  appState: {
                    viewBackgroundColor: '#FDFCFA',
                    zenModeEnabled: !editing,
                  } as any,
                  scrollToContent: true,
                }}
                viewModeEnabled={!editing}
                zenModeEnabled={!editing}
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: false,
                    clearCanvas: false,
                    export: editing ? { saveFileToDisk: false } as any : false,
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                    saveAsImage: true,
                  },
                }}
              />
            </DiagramFrame>
          ) : (
            <DiagramFrame height={frameHeight}><CanvasSkeleton label="Converting to Excalidraw…" /></DiagramFrame>
          )}
          {editing && (
            <p className="mt-2 text-[11px] text-text-muted">
              Drag, resize, rename anything. Click <strong>Save</strong> when you're done — the diagram will be marked as manually edited and won't be overwritten unless you regenerate on purpose.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Widen any container/box that has a bound text element so Excalidraw's wider hand-drawn font
// (Virgil) doesn't clip the first/last letters. Mermaid measures width in sans-serif; Virgil is
// ~20% wider per character — we over-provision by ~1 character on each side and re-centre.
function padContainersForVirgil(elements: any[]): any[] {
  const byId = new Map<string, any>(elements.map((e) => [e.id, e]));
  // Estimated character width at font size 16 in Virgil: ~10px per char. We add ~1 char slack
  // per side (20% of measured width, capped) so we never clip.
  for (const el of elements) {
    if (el.type !== 'text' || !el.containerId) continue;
    const container = byId.get(el.containerId);
    if (!container) continue;
    const textLen = String(el.text ?? el.originalText ?? '').length;
    const currentWidth = container.width ?? 0;
    // Slack: 20% of container width OR ~14px per side (2 chars), whichever is greater.
    const slack = Math.max(currentWidth * 0.2, 28);
    const newWidth = currentWidth + slack;
    // Keep the container centred on its original centre point
    container.x = (container.x ?? 0) - slack / 2;
    container.width = newWidth;
    // The text element's x/width are usually recomputed by Excalidraw on load via container
    // binding, but nudge it to be safe.
    if (typeof el.x === 'number' && typeof el.width === 'number') {
      el.x = (container.x ?? 0) + (container.width - el.width) / 2;
    }
    // Also grow height slightly if the text is close to the vertical edge (some flowchart
    // labels wrap and get cropped top/bottom too).
    if (textLen > 20 && (container.height ?? 0) < 60) {
      const heightSlack = 8;
      container.y = (container.y ?? 0) - heightSlack / 2;
      container.height = (container.height ?? 0) + heightSlack;
    }
  }
  return elements;
}

function DiagramFrame({ children, height = VIEW_HEIGHT }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="excalidraw-frame w-full overflow-hidden rounded-md border border-border-muted bg-white" style={{ height }}>
      {children}
    </div>
  );
}

function CanvasSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-text-muted">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
