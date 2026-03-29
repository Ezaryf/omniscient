import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { CanvasDocumentSchema, type CanvasDocument } from "@/lib/sim/types";

const CANVAS_DIR = path.join(process.cwd(), ".omniscient-data");
const CANVAS_FILE = path.join(CANVAS_DIR, "canvases.json");

type CanvasStorePayload = {
  documents: CanvasDocument[];
};

async function ensureCanvasDir() {
  await mkdir(CANVAS_DIR, { recursive: true });
}

async function readPayload(): Promise<CanvasStorePayload> {
  await ensureCanvasDir();

  try {
    const raw = await readFile(CANVAS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<CanvasStorePayload>;
    return {
      documents: Array.isArray(parsed.documents)
        ? parsed.documents
            .map((document) => CanvasDocumentSchema.safeParse(document))
            .filter((result): result is { success: true; data: CanvasDocument } => result.success)
            .map((result) => result.data)
        : [],
    };
  } catch {
    return { documents: [] };
  }
}

async function writePayload(payload: CanvasStorePayload) {
  await ensureCanvasDir();
  await writeFile(CANVAS_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function createCanvasId() {
  return `canvas-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listProjectCanvasDocuments(projectId: string): Promise<CanvasDocument[]> {
  const payload = await readPayload();
  return payload.documents
    .filter((document) => document.projectId === projectId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getCanvasDocument(canvasId: string): Promise<CanvasDocument | null> {
  const payload = await readPayload();
  return payload.documents.find((document) => document.id === canvasId) ?? null;
}

export async function createCanvasDocument(projectId: string, name: string): Promise<CanvasDocument> {
  const payload = await readPayload();
  const now = new Date().toISOString();
  const document: CanvasDocument = {
    id: createCanvasId(),
    projectId,
    name: name.trim() || "Freeform Canvas",
    snapshot: null,
    bindings: [],
    createdAt: now,
    updatedAt: now,
  };

  payload.documents.unshift(document);
  await writePayload(payload);
  return document;
}

export async function saveCanvasDocument(
  canvasId: string,
  patch: Pick<CanvasDocument, "snapshot" | "bindings"> & Partial<Pick<CanvasDocument, "name">>
): Promise<CanvasDocument | null> {
  const payload = await readPayload();
  const index = payload.documents.findIndex((document) => document.id === canvasId);
  if (index === -1) return null;

  const current = payload.documents[index];
  const next: CanvasDocument = {
    ...current,
    name: patch.name?.trim() || current.name,
    snapshot: patch.snapshot,
    bindings: patch.bindings,
    updatedAt: new Date().toISOString(),
  };

  payload.documents[index] = CanvasDocumentSchema.parse(next);
  await writePayload(payload);
  return payload.documents[index];
}

export async function deleteProjectCanvasDocuments(projectId: string): Promise<void> {
  const payload = await readPayload();
  const remaining = payload.documents.filter((document) => document.projectId !== projectId);
  if (remaining.length === payload.documents.length) return;
  await writePayload({ documents: remaining });
}

export async function resetCanvasStoreFile(): Promise<void> {
  await rm(CANVAS_FILE, { force: true });
}
