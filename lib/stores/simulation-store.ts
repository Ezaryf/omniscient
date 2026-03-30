import { create } from "zustand";
import type {
  ActionProposal,
  Agent,
  BoardSelection,
  CampaignSetupDraft,
  CausalEventType,
  SimEvent,
  TimelineBranch,
  WorldState,
} from "@/lib/sim/types";
import type { StateDelta } from "@/lib/sim/diff";

export type SimStatus = "idle" | "playing" | "paused" | "stepping" | "loading" | "error";

export interface AiSettings {
  provider: "openai" | "anthropic" | "gemini" | "groq" | "ollama";
  apiKey: string;
  model: string;
}

export interface WorkspaceDockLayout {
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineCollapsed: boolean;
  snap: boolean;
}

export interface WorkspaceSettings {
  appearance: {
    density: "comfortable" | "compact";
    contrast: "soft" | "normal";
    cornerRadius: "soft" | "tight";
    textScale: "sm" | "md" | "lg";
    iconScale: "sm" | "md" | "lg";
    reducedMotion: boolean;
  };
  layout: WorkspaceDockLayout;
  map: {
    labelDensity: "minimal" | "balanced" | "dense";
    showRouteLabels: boolean;
    frontOverlayIntensity: "low" | "medium" | "high";
    projectionsDefault: boolean;
    hiddenKeys: string[];
    layoutAssist: boolean;
    layoutSpacing: number;
  };
  timeline: {
    density: "compact" | "comfortable";
    projectionCards: number;
    eventScale: "sm" | "md" | "lg";
  };
  simulation: {
    autoplayOnLaunch: boolean;
    tickSpeed: number;
    branchPrefix: string;
    defaultEventType: CausalEventType;
  };
}

const PROVIDER_DEFAULT_MODELS: Record<AiSettings["provider"], string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-3-5-sonnet-20241022",
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3",
};

const PROVIDER_MODELS: Record<AiSettings["provider"], string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  ollama: ["llama3", "mistral", "phi3", "custom"],
};

interface SimulationState {
  projectId: string | null;
  projectMeta: { name: string; description: string } | null;
  branchId: string | null;
  worldState: WorldState | null;
  branches: TimelineBranch[];
  selectedEntity: BoardSelection | null;
  aiSettings: AiSettings;
  workspaceSettings: WorkspaceSettings;
  status: SimStatus;
  tickSpeed: number;
  recentEvents: SimEvent[];
  lastProposals: ActionProposal[];
  projections: any[];
  showProjections: boolean;
  isNewSimulation: boolean;
  setupStatus: "drafting" | "ready" | "applied" | "dismissed";
  setupDraft: CampaignSetupDraft | null;
  setAiSettings: (settings: Partial<AiSettings>) => void;
  setWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void;
  updateDockLayout: (layout: Partial<WorkspaceDockLayout>) => void;
  resetWorkspaceSettings: () => void;
  setProject: (projectId: string) => void;
  setProjectMeta: (meta: { name: string; description: string } | null) => void;
  setBranch: (branchId: string) => void;
  setWorldState: (state: WorldState) => void;
  applyDelta: (delta: StateDelta) => void;
  setBranches: (branches: TimelineBranch[]) => void;
  setSelectedEntity: (selection: BoardSelection | null) => void;
  setStatus: (status: SimStatus) => void;
  setTickSpeed: (speed: number) => void;
  addEvents: (events: SimEvent[]) => void;
  setLastProposals: (proposals: ActionProposal[]) => void;
  setProjections: (projections: any[]) => void;
  setShowProjections: (show: boolean) => void;
  setIsNewSimulation: (isNewSimulation: boolean) => void;
  setSetupStatus: (status: SimulationState["setupStatus"]) => void;
  setSetupDraft: (draft: CampaignSetupDraft | null) => void;
  sync: () => Promise<void>;
  currentTick: () => number;
  aliveAgentCount: () => number;
}

function isBlankWorldState(state: WorldState | null) {
  if (!state) return true;
  return (
    state.tick === 0 &&
    state.agents.length === 0 &&
    state.events.length === 0 &&
    state.fronts.length === 0 &&
    state.map.regions.length === 0 &&
    state.map.routes.length === 0 &&
    state.map.tokens.length === 0
  );
}

function getStoredValue(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  appearance: {
    density: "comfortable",
    contrast: "soft",
    cornerRadius: "soft",
    textScale: "md",
    iconScale: "md",
    reducedMotion: false,
  },
  layout: {
    leftWidth: 320,
    rightWidth: 340,
    timelineHeight: 260,
    leftCollapsed: false,
    rightCollapsed: false,
    timelineCollapsed: false,
    snap: true,
  },
  map: {
    labelDensity: "balanced",
    showRouteLabels: true,
    frontOverlayIntensity: "medium",
    projectionsDefault: false,
    hiddenKeys: [],
    layoutAssist: true,
    layoutSpacing: 150,
  },
  timeline: {
    density: "comfortable",
    projectionCards: 4,
    eventScale: "md",
  },
  simulation: {
    autoplayOnLaunch: false,
    tickSpeed: 1000,
    branchPrefix: "Fork",
    defaultEventType: "injected",
  },
};

function getInitialWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem("workspace-settings");
    if (!stored) return DEFAULT_WORKSPACE_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<WorkspaceSettings>;
    return {
      appearance: { ...DEFAULT_WORKSPACE_SETTINGS.appearance, ...parsed.appearance },
      layout: { ...DEFAULT_WORKSPACE_SETTINGS.layout, ...parsed.layout },
      map: { ...DEFAULT_WORKSPACE_SETTINGS.map, ...parsed.map },
      timeline: { ...DEFAULT_WORKSPACE_SETTINGS.timeline, ...parsed.timeline },
      simulation: { ...DEFAULT_WORKSPACE_SETTINGS.simulation, ...parsed.simulation },
    };
  } catch {
    return DEFAULT_WORKSPACE_SETTINGS;
  }
}

function persistWorkspaceSettings(settings: WorkspaceSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("workspace-settings", JSON.stringify(settings));
}

function normalizeAiSettings(settings: AiSettings): AiSettings {
  const provider = settings.provider in PROVIDER_DEFAULT_MODELS ? settings.provider : "gemini";
  const allowedModels = PROVIDER_MODELS[provider];
  const model = allowedModels.includes(settings.model)
    ? settings.model
    : PROVIDER_DEFAULT_MODELS[provider];

  return {
    provider,
    apiKey: settings.apiKey,
    model,
  };
}

function getInitialAiSettings(): AiSettings {
  const initial = normalizeAiSettings({
    provider: getStoredValue("sim-provider", "gemini") as AiSettings["provider"],
    apiKey: getStoredValue("sim-api-key", ""),
    model: getStoredValue("sim-model", PROVIDER_DEFAULT_MODELS.gemini),
  });

  if (typeof window !== "undefined") {
    window.localStorage.setItem("sim-provider", initial.provider);
    window.localStorage.setItem("sim-model", initial.model);
  }

  return initial;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  projectId: null,
  projectMeta: null,
  branchId: null,
  worldState: null,
  branches: [],
  selectedEntity: null,
  status: "idle",
  tickSpeed: getInitialWorkspaceSettings().simulation.tickSpeed,
  recentEvents: [],
  lastProposals: [],
  projections: [],
  showProjections: getInitialWorkspaceSettings().map.projectionsDefault,
  isNewSimulation: false,
  setupStatus: "dismissed",
  setupDraft: null,
  aiSettings: getInitialAiSettings(),
  workspaceSettings: getInitialWorkspaceSettings(),

  setAiSettings: (settings) =>
    set((previous) => {
      const nextSettings = normalizeAiSettings({ ...previous.aiSettings, ...settings });
      if (typeof window !== "undefined") {
        if (nextSettings.provider) window.localStorage.setItem("sim-provider", nextSettings.provider);
        if (settings.apiKey !== undefined) window.localStorage.setItem("sim-api-key", settings.apiKey);
        if (nextSettings.model) window.localStorage.setItem("sim-model", nextSettings.model);
      }
      return { aiSettings: nextSettings };
    }),
  setWorkspaceSettings: (settings) =>
    set((previous) => {
      const nextSettings: WorkspaceSettings = {
        appearance: { ...previous.workspaceSettings.appearance, ...settings.appearance },
        layout: { ...previous.workspaceSettings.layout, ...settings.layout },
        map: { ...previous.workspaceSettings.map, ...settings.map },
        timeline: { ...previous.workspaceSettings.timeline, ...settings.timeline },
        simulation: { ...previous.workspaceSettings.simulation, ...settings.simulation },
      };
      persistWorkspaceSettings(nextSettings);
      return {
        workspaceSettings: nextSettings,
        tickSpeed: nextSettings.simulation.tickSpeed,
        showProjections: nextSettings.map.projectionsDefault,
      };
    }),
  updateDockLayout: (layout) =>
    set((previous) => {
      const nextSettings: WorkspaceSettings = {
        ...previous.workspaceSettings,
        layout: { ...previous.workspaceSettings.layout, ...layout },
      };
      persistWorkspaceSettings(nextSettings);
      return { workspaceSettings: nextSettings };
    }),
  resetWorkspaceSettings: () =>
    set(() => {
      persistWorkspaceSettings(DEFAULT_WORKSPACE_SETTINGS);
      return {
        workspaceSettings: DEFAULT_WORKSPACE_SETTINGS,
        tickSpeed: DEFAULT_WORKSPACE_SETTINGS.simulation.tickSpeed,
        showProjections: DEFAULT_WORKSPACE_SETTINGS.map.projectionsDefault,
      };
    }),

  setProject: (projectId) => set({ projectId }),
  setProjectMeta: (projectMeta) => set({ projectMeta }),
  setBranch: (branchId) => set({ branchId }),
  setWorldState: (state) =>
    set((previous) => {
      return {
        worldState: state,
        recentEvents: state.events.slice(-100),
        isNewSimulation: isBlankWorldState(state),
        setupStatus: isBlankWorldState(state)
          ? previous.setupStatus === "dismissed"
            ? "dismissed"
            : previous.setupDraft
              ? "ready"
              : "drafting"
          : "applied",
      };
    }),
  applyDelta: (delta) =>
    set((previous) => {
      if (!previous.worldState) return previous;

      const agents = previous.worldState.agents.map((agent) => {
        const updated = delta.changedAgents.find((candidate) => candidate.id === agent.id);
        return updated ?? agent;
      });

      const relationships = previous.worldState.relationships.map((relationship) => {
        const updated = delta.changedRelationships.find((candidate) => candidate.id === relationship.id);
        return updated ?? relationship;
      });

      const nextEvents = [...previous.worldState.events, ...delta.newEvents].slice(-200);
      const nextState: WorldState = {
        ...previous.worldState,
        tick: delta.tick,
        seed: delta.seed,
        agents,
        relationships,
        events: nextEvents,
        fronts: delta.fronts,
        map: delta.map,
        projections: delta.projections,
        gmNotes: delta.gmNotes,
        campaignNodes: delta.campaignNodes,
        boardLinks: delta.boardLinks,
      };

      return {
        worldState: nextState,
        recentEvents: nextEvents.slice(-100),
      };
    }),
  setBranches: (branches) => set({ branches }),
  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),
  setStatus: (status) => set({ status }),
  setTickSpeed: (tickSpeed) =>
    set((previous) => {
      const nextSettings: WorkspaceSettings = {
        ...previous.workspaceSettings,
        simulation: { ...previous.workspaceSettings.simulation, tickSpeed },
      };
      persistWorkspaceSettings(nextSettings);
      return { tickSpeed, workspaceSettings: nextSettings };
    }),
  addEvents: (events) =>
    set((previous) => ({
      recentEvents: [...previous.recentEvents, ...events].slice(-100),
    })),
  setLastProposals: (lastProposals) => set({ lastProposals }),
  setProjections: (projections) => set({ projections }),
  setShowProjections: (showProjections) => set({ showProjections }),
  setIsNewSimulation: (isNewSimulation) => set({ isNewSimulation }),
  setSetupStatus: (setupStatus) => set({ setupStatus }),
  setSetupDraft: (setupDraft) =>
    set((previous) => ({
      setupDraft,
      setupStatus: setupDraft ? "ready" : previous.setupStatus === "applied" ? "applied" : "drafting",
    })),
  sync: async () => {
    const { branchId, projectId, worldState } = get();
    if (!branchId || !projectId) return;

    try {
      const response = await fetch(`/api/branches/detail?id=${branchId}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.branch && data.branch.currentTick >= (worldState?.tick ?? 0)) {
        get().setWorldState(data.branch.latestState);
      }

      const branchResponse = await fetch(`/api/branches?projectId=${projectId}`);
      if (!branchResponse.ok) return;
      const branchData = await branchResponse.json();
      if (branchData.branches) {
        get().setBranches(branchData.branches);
      }
    } catch (error) {
      console.error("[Sync] Heartbeat error:", error);
    }
  },
  currentTick: () => get().worldState?.tick ?? 0,
  aliveAgentCount: () =>
    get().worldState?.agents.filter((agent) => agent.status === "alive").length ?? 0,
}));
