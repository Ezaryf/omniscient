"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Focus, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLShapeId,
} from "tldraw";
import type { CanvasBinding, CanvasBindingEntityType, CanvasDocument, WorldState } from "@/lib/sim/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type MetadataDensity = "minimal" | "dense";

type WorldInsertable = {
  entityType: CanvasBindingEntityType;
  entityId: string;
  label: string;
  description: string;
  tone: "agent" | "faction" | "region" | "site" | "front" | "event";
};

interface FreeformCanvasProps {
  readonly projectId: string;
  readonly worldState: WorldState | null;
  readonly initialCanvasId?: string | null;
  readonly onCanvasChange: (canvasId: string | null) => void;
  readonly onBindingSelect: (binding: CanvasBinding | null) => void;
}

function toneToTldrawColor(tone: WorldInsertable["tone"]) {
  switch (tone) {
    case "agent":
      return "blue";
    case "faction":
      return "violet";
    case "region":
      return "green";
    case "site":
      return "yellow";
    case "front":
      return "red";
    case "event":
      return "orange";
    default:
      return "grey";
  }
}

function buildInsertables(state: WorldState | null): WorldInsertable[] {
  if (!state) return [];

  const factionIds = Array.from(new Set(state.agents.map((agent) => agent.factionId)));
  const factionCards: WorldInsertable[] = factionIds.map((factionId) => {
    const members = state.agents.filter((agent) => agent.factionId === factionId);
    return {
      entityType: "faction",
      entityId: factionId,
      label: factionId.replace(/^faction-/, "").replace(/-/g, " "),
      description: `${members.length} linked actor${members.length === 1 ? "" : "s"}`,
      tone: "faction",
    };
  });

  const regionCards: WorldInsertable[] = state.map.regions.map((region) => ({
    entityType: "region",
    entityId: region.id,
    label: region.name,
    description: `Supply ${Math.round(region.supply * 100)} · Stability ${Math.round(region.stability * 100)}`,
    tone: "region",
  }));

  const siteCards: WorldInsertable[] = state.map.sites.map((site) => ({
    entityType: "site",
    entityId: site.id,
    label: site.name,
    description: `${site.kind} · ${site.status}`,
    tone: "site",
  }));

  const frontCards: WorldInsertable[] = state.fronts.map((front) => ({
    entityType: "front",
    entityId: front.id,
    label: front.name,
    description: `${front.status} · Progress ${Math.round(front.progress * 100)}%`,
    tone: "front",
  }));

  const eventCards: WorldInsertable[] = state.events.slice(-18).reverse().map((event) => ({
    entityType: "event",
    entityId: event.id,
    label: `Tick ${event.tick}`,
    description: event.description,
    tone: "event",
  }));

  const agentCards: WorldInsertable[] = state.agents.map((agent) => ({
    entityType: "agent",
    entityId: agent.id,
    label: agent.name,
    description: `${agent.type} · ${agent.factionId.replace(/^faction-/, "")}`,
    tone: "agent",
  }));

  return [...agentCards, ...factionCards, ...regionCards, ...siteCards, ...frontCards, ...eventCards];
}

function buildShapeText(entity: WorldInsertable, state: WorldState | null, density: MetadataDensity) {
  if (density === "minimal" || !state) return entity.label;

  if (entity.entityType === "agent") {
    const agent = state.agents.find((candidate) => candidate.id === entity.entityId);
    if (!agent) return entity.label;
    return `${agent.name}\n${agent.type} · ${agent.factionId.replace(/^faction-/, "")}\nInfluence ${Math.round(agent.state.influence)} · Morale ${Math.round(agent.state.morale * 100)}%`;
  }

  if (entity.entityType === "region") {
    const region = state.map.regions.find((candidate) => candidate.id === entity.entityId);
    if (!region) return entity.label;
    return `${region.name}\n${region.kind}\nSupply ${Math.round(region.supply * 100)} · Threat ${Math.round(region.threat * 100)}`;
  }

  if (entity.entityType === "site") {
    const site = state.map.sites.find((candidate) => candidate.id === entity.entityId);
    if (!site) return entity.label;
    return `${site.name}\n${site.kind} · ${site.status}`;
  }

  if (entity.entityType === "front") {
    const front = state.fronts.find((candidate) => candidate.id === entity.entityId);
    if (!front) return entity.label;
    return `${front.name}\n${front.status}\nProgress ${Math.round(front.progress * 100)} · Pressure ${Math.round(front.pressure * 100)}`;
  }

  if (entity.entityType === "event") {
    const event = state.events.find((candidate) => candidate.id === entity.entityId);
    if (!event) return entity.label;
    return `Tick ${event.tick}\n${event.description}`;
  }

  return `${entity.label}\n${entity.description}`;
}

export function FreeformCanvas({
  projectId,
  worldState,
  initialCanvasId,
  onCanvasChange,
  onBindingSelect,
}: FreeformCanvasProps) {
  const [documents, setDocuments] = useState<CanvasDocument[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(initialCanvasId ?? null);
  const [activeDocument, setActiveDocument] = useState<CanvasDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [metadataDensity, setMetadataDensity] = useState<MetadataDensity>("dense");
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bindingsRef = useRef<CanvasBinding[]>([]);
  const insertIndexRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const selectionCleanupRef = useRef<(() => void) | null>(null);

  const insertables = useMemo(() => buildInsertables(worldState), [worldState]);
  const filteredInsertables = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return insertables;
    return insertables.filter((entry) =>
      `${entry.label} ${entry.description}`.toLowerCase().includes(query)
    );
  }, [filter, insertables]);

  const syncSelection = useCallback(
    (editor: Editor) => {
      const selectedShapeIds = editor.getSelectedShapeIds() as string[];
      const selectedBinding =
        bindingsRef.current.find((binding) => selectedShapeIds.includes(binding.shapeId)) ?? null;
      onBindingSelect(selectedBinding);
    },
    [onBindingSelect]
  );

  const persistDocument = useCallback(
    async (editor: Editor) => {
      if (!activeCanvasId) return;
      const bindings = bindingsRef.current.filter((binding) =>
        editor.getShape(binding.shapeId as TLShapeId)
      );
      bindingsRef.current = bindings;

      await fetch(`/api/canvases/${activeCanvasId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: activeDocument?.name ?? "Freeform Canvas",
          snapshot: editor.getSnapshot(),
          bindings,
        }),
      });
    },
    [activeCanvasId, activeDocument?.name]
  );

  const schedulePersist = useCallback(
    (editor: Editor) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        void persistDocument(editor);
      }, 600);
    },
    [persistDocument]
  );

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/canvases?projectId=${projectId}`);
      const data = await response.json();
      const docs = (data.documents ?? []) as CanvasDocument[];
      setDocuments(docs);
      const nextId =
        initialCanvasId && docs.some((candidate) => candidate.id === initialCanvasId)
          ? initialCanvasId
          : docs[0]?.id ?? null;
      setActiveCanvasId(nextId);
      onCanvasChange(nextId);
    } finally {
      setIsLoading(false);
    }
  }, [initialCanvasId, onCanvasChange, projectId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!activeCanvasId) {
      setActiveDocument(null);
      return;
    }

    let cancelled = false;
    const loadDocument = async () => {
      const response = await fetch(`/api/canvases/${activeCanvasId}`);
      const data = await response.json();
      if (cancelled) return;
      const document = (data.document ?? null) as CanvasDocument | null;
      setActiveDocument(document);
      bindingsRef.current = document?.bindings ?? [];
    };

    void loadDocument();
    return () => {
      cancelled = true;
    };
  }, [activeCanvasId]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
      if (selectionCleanupRef.current) selectionCleanupRef.current();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleCreateCanvas = useCallback(async () => {
    setIsCreating(true);
    try {
      const response = await fetch("/api/canvases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: `Freeform Canvas ${documents.length + 1}`,
        }),
      });
      const data = await response.json();
      const document = data.document as CanvasDocument;
      setDocuments((current) => [document, ...current]);
      setActiveCanvasId(document.id);
      setActiveDocument(document);
      bindingsRef.current = [];
      onCanvasChange(document.id);
    } finally {
      setIsCreating(false);
    }
  }, [documents.length, onCanvasChange, projectId]);

  const handleCanvasSelect = useCallback(
    (canvasId: string) => {
      setActiveCanvasId(canvasId);
      onCanvasChange(canvasId);
      onBindingSelect(null);
    },
    [onBindingSelect, onCanvasChange]
  );

  const updateBoundShapeLabels = useCallback(
    (editor: Editor, density: MetadataDensity) => {
      const updates = bindingsRef.current
        .map((binding) => {
          const shape = editor.getShape(binding.shapeId as TLShapeId);
          const entity = insertables.find(
            (candidate) =>
              candidate.entityId === binding.entityId && candidate.entityType === binding.entityType
          );
          if (!shape || !entity || shape.type !== "geo") return null;
          return {
            id: binding.shapeId as TLShapeId,
            type: "geo" as const,
            props: {
              ...shape.props,
              text: buildShapeText(entity, worldState, density),
            },
          };
        })
        .filter(Boolean) as Array<any>;

      if (updates.length > 0) {
        editor.updateShapes(updates);
      }
    },
    [insertables, worldState]
  );

  const handleInsertEntity = useCallback(
    (entity: WorldInsertable) => {
      const editor = editorRef.current;
      if (!editor) return;

      const shapeId = createShapeId();
      const index = insertIndexRef.current++;
      const x = 80 + (index % 4) * 320;
      const y = 80 + Math.floor(index / 4) * 180;
      const text = buildShapeText(entity, worldState, metadataDensity);

      editor.createShapes([
        {
          id: shapeId,
          type: "geo",
          x,
          y,
          props: {
            geo: "rectangle",
            w: 280,
            h: metadataDensity === "dense" ? 116 : 76,
            text,
            color: toneToTldrawColor(entity.tone),
            fill: "semi",
            size: "m",
            font: "sans",
            align: "start",
            verticalAlign: "start",
          },
        } as any,
      ]);

      const binding: CanvasBinding = {
        id: `binding-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        shapeId: shapeId as string,
        entityType: entity.entityType,
        entityId: entity.entityId,
      };
      bindingsRef.current = [...bindingsRef.current, binding];
      editor.select(shapeId);
      syncSelection(editor);
      schedulePersist(editor);
      setPickerOpen(false);
    },
    [metadataDensity, schedulePersist, syncSelection, worldState]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      if (cleanupRef.current) cleanupRef.current();
      if (selectionCleanupRef.current) selectionCleanupRef.current();

      editor.user.updateUserPreferences({
        colorScheme: "dark",
        animationSpeed: 0,
      });

      if (activeDocument?.snapshot) {
        editor.loadSnapshot(activeDocument.snapshot as any);
      }

      cleanupRef.current = editor.store.listen(
        () => {
          schedulePersist(editor);
        },
        { scope: "document", source: "user" }
      );

      selectionCleanupRef.current = editor.store.listen(
        () => {
          syncSelection(editor);
        },
        { scope: "session", source: "user" }
      );
    },
    [activeDocument?.snapshot, schedulePersist, syncSelection]
  );

  const handleFit = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.selectAll();
    editor.zoomToSelection({ animation: { duration: 220 } });
    editor.selectNone();
  }, []);

  const handleFocusSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.zoomToSelection({ animation: { duration: 220 } });
  }, []);

  const handleToggleDensity = useCallback(() => {
    const nextDensity = metadataDensity === "dense" ? "minimal" : "dense";
    setMetadataDensity(nextDensity);
    const editor = editorRef.current;
    if (!editor) return;
    updateBoundShapeLabels(editor, nextDensity);
    schedulePersist(editor);
  }, [metadataDensity, schedulePersist, updateBoundShapeLabels]);

  return (
    <div className="freeform-canvas-shell relative h-full overflow-hidden rounded-[inherit] border border-[var(--border-subtle)] bg-black">
      <div className="absolute left-4 right-4 top-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-black/88 px-3 py-3 backdrop-blur-md">
        <Badge variant="default">Freeform Canvas</Badge>
        <select
          value={activeCanvasId ?? ""}
          onChange={(event) => handleCanvasSelect(event.target.value)}
          className="h-9 min-w-[220px] rounded-md border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 text-sm text-[var(--text-primary)] outline-none"
        >
          {documents.length === 0 ? <option value="">No canvases yet</option> : null}
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={handleCreateCanvas} disabled={isCreating} type="button">
          <Plus className="h-3.5 w-3.5" />
          {isCreating ? "Creating..." : "New Canvas"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)} disabled={!activeCanvasId} type="button">
          <Sparkles className="h-3.5 w-3.5" />
          Add from World
        </Button>
        <Button size="sm" variant="ghost" onClick={handleFit} disabled={!activeCanvasId} type="button">
          <RefreshCw className="h-3.5 w-3.5" />
          Fit
        </Button>
        <Button size="sm" variant="ghost" onClick={handleFocusSelection} disabled={!activeCanvasId} type="button">
          <Focus className="h-3.5 w-3.5" />
          Focus
        </Button>
        <Button size="sm" variant={metadataDensity === "dense" ? "primary" : "ghost"} onClick={handleToggleDensity} disabled={!activeCanvasId} type="button">
          Dense Labels
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-[var(--text-secondary)]">
          Loading freeform canvases...
        </div>
      ) : activeCanvasId ? (
        <div className="relative h-full pt-[68px]">
          {/* Atmospheric Background Layer */}
          <div 
            className="pointer-events-none absolute inset-0 z-0 opacity-40 mix-blend-overlay"
            style={{
              background: "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #020617 100%)",
            }}
          />
          <div 
            className="pointer-events-none absolute left-[-10%] top-[-10%] h-[120%] w-[120%] z-0"
            style={{
              background: "radial-gradient(circle at 20% 30%, rgba(34, 211, 238, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)",
              filter: "blur(80px)"
            }}
          />
          
          <Tldraw
            key={activeCanvasId}
            onMount={handleMount}
            hideUi
            inferDarkMode={false}
            className="freeform-tldraw relative z-10"
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-dock)] p-8 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Boundless freeform mode
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              Create your first whiteboard
            </h3>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              This mode is separate from the campaign map. Use it for relationship sketches, causal diagrams,
              prep boards, and loose planning surfaces.
            </p>
            <div className="mt-6">
              <Button size="sm" variant="primary" onClick={handleCreateCanvas} disabled={isCreating} type="button">
                <Plus className="h-3.5 w-3.5" />
                Create Freeform Canvas
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add from World</DialogTitle>
            <DialogDescription>
              Drop campaign entities into the freeform canvas as bound whiteboard nodes.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Search agents, regions, fronts, events..."
                className="pl-9"
              />
            </div>
            <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
              {filteredInsertables.map((entry) => (
                <button
                  key={`${entry.entityType}:${entry.entityId}`}
                  type="button"
                  onClick={() => handleInsertEntity(entry)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{entry.label}</div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">{entry.description}</div>
                    </div>
                    <Badge variant="default">{entry.entityType}</Badge>
                  </div>
                </button>
              ))}
              {filteredInsertables.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-secondary)]">
                  No matching world entities.
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setPickerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .freeform-canvas-shell .tl-container {
          background: transparent !important;
          --tl-color-background: transparent !important;
          --tl-color-low: #050505 !important;
          --tl-color-muted-1: #0b0b0b !important;
          --tl-color-muted-2: #111111 !important;
        }

        .freeform-canvas-shell .tl-background {
          background-color: transparent !important;
        }

        .freeform-canvas-shell .tl-canvas {
          background: transparent !important;
        }

        .freeform-canvas-shell .tl-theme__dark,
        .freeform-canvas-shell .tl-theme__light {
          background: transparent !important;
          --tl-color-background: transparent !important;
        }

        .freeform-canvas-shell .tl-page,
        .freeform-canvas-shell .tl-foreground,
        .freeform-canvas-shell .tl-overlays {
          background-color: transparent !important;
        }

        .freeform-canvas-shell .tl-grid {
          opacity: 0.05;
        }
      `}</style>
    </div>
  );
}
