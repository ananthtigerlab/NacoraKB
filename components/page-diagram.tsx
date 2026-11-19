'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, ChevronRight, Loader2, Sparkles, AlertTriangle, PencilRuler } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';

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

export function PageDiagram({ pageId, diagram: initialDiagram, diagramScene: initialScene }: Props) {
  const [diagram] = React.useState<string | null>(initialDiagram ?? null);
  const [savedScene] = React.useState<SceneJSON | null>(initialScene ?? null);
  const [open, setOpen] = React.useState(true);
  const [scene, setScene] = React.useState<LocalScene | null>(null);
  const [renderError, setRenderError] = React.useState<string | null>(null);
  const [converting, setConverting] = React.useState(false);
  const isEdited = savedScene !== null;

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + pageId);
      if (stored !== null) setOpen(stored === '1');
    } catch {}
  }, [pageId]);

  React.useEffect(() => {
    if (!open) { setScene(null); return; }
    let cancelled = false;

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
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(STORAGE_PREFIX + pageId, next ? '1' : '0'); } catch {}
  }

  const nothingToShow = !diagram && !savedScene;
  if (nothingToShow) return null;

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
            </div>
          ) : scene ? (
            <DiagramFrame>
              <Excalidraw
                key={`${pageId}:view:${isEdited ? 'saved' : 'llm'}`}
                initialData={{
                  elements: scene.elements as any,
                  files: scene.files as any,
                  appState: {
                    viewBackgroundColor: '#FDFCFA',
                    zenModeEnabled: true,
                  } as any,
                  scrollToContent: true,
                }}
                viewModeEnabled={true}
                zenModeEnabled={true}
                UIOptions={{
                  canvasActions: {
                    changeViewBackgroundColor: false,
                    clearCanvas: false,
                    export: false,
                    loadScene: false,
                    saveToActiveFile: false,
                    toggleTheme: false,
                    saveAsImage: true,
                  },
                }}
              />
            </DiagramFrame>
          ) : (
            <DiagramFrame><CanvasSkeleton label="Converting to Excalidraw…" /></DiagramFrame>
          )}
        </div>
      )}
    </div>
  );
}

function padContainersForVirgil(elements: any[]): any[] {
  const byId = new Map<string, any>(elements.map((e) => [e.id, e]));
  for (const el of elements) {
    if (el.type !== 'text' || !el.containerId) continue;
    const container = byId.get(el.containerId);
    if (!container) continue;
    const textLen = String(el.text ?? el.originalText ?? '').length;
    const currentWidth = container.width ?? 0;
    const slack = Math.max(currentWidth * 0.2, 28);
    const newWidth = currentWidth + slack;
    container.x = (container.x ?? 0) - slack / 2;
    container.width = newWidth;
    if (typeof el.x === 'number' && typeof el.width === 'number') {
      el.x = (container.x ?? 0) + (container.width - el.width) / 2;
    }
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
