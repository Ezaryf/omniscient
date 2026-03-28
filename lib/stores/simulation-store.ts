import { create } from "zustand";
import type { WorldState, SimEvent, Agent, TimelineBranch, ActionProposal } from "@/lib/sim/types";
import type { StateDelta } from "@/lib/sim/diff";

export type SimStatus = "idle" | "playing" | "paused" | "stepping" | "loading" | "error";

export interface AiSettings {
  provider: "openai" | "anthropic" | "gemini" | "groq" | "ollama";
  apiKey: string;
  model: string;
}

interface SimulationState {
  // Core state
  projectId: string | null;
  branchId: string | null;
  worldState: WorldState | null;
  branches: TimelineBranch[];
  selectedAgentId: string | null;
  selectedAgent: Agent | null;

  // AI Configuration
  aiSettings: AiSettings;
  setAiSettings: (settings: Partial<AiSettings>) => void;

  // Playback
  status: SimStatus;
  tickSpeed: number; // ms between ticks in play mode

  // Event log
  recentEvents: SimEvent[];
  lastProposals: ActionProposal[];
  projections: { tick: number; agents: any[]; events: string[] }[];
  showProjections: boolean;

  // Actions
  setProject: (projectId: string) => void;
  setBranch: (branchId: string) => void;
  setWorldState: (state: WorldState) => void;
  applyDelta: (delta: StateDelta) => void;
  setBranches: (branches: TimelineBranch[]) => void;
  setSelectedAgent: (agentId: string | null) => void;
  setStatus: (status: SimStatus) => void;
  setTickSpeed: (speed: number) => void;
  addEvents: (events: SimEvent[]) => void;
  setLastProposals: (proposals: ActionProposal[]) => void;
  setProjections: (projections: any[]) => void;
  setShowProjections: (show: boolean) => void;
  sync: () => Promise<void>;

  // Derived
  currentTick: () => number;
  aliveAgentCount: () => number;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  projectId: null,
  branchId: null,
  worldState: null,
  branches: [],
  selectedAgentId: null,
  selectedAgent: null,
  status: "idle",
  tickSpeed: 1000,
  recentEvents: [],
  lastProposals: [],
  projections: [],
  showProjections: false,

  // Initial AI settings from localStorage
  aiSettings: {
    provider: (typeof window !== "undefined" && localStorage.getItem("sim-provider") as any) || "gemini",
    apiKey: (typeof window !== "undefined" && localStorage.getItem("sim-api-key")) || "",
    model: (typeof window !== "undefined" && localStorage.getItem("sim-model")) || "gemini-1.5-pro",
  },

  setAiSettings: (settings) =>
    set((prev) => {
      const newSettings = { ...prev.aiSettings, ...settings };
      if (typeof globalThis.window !== "undefined") {
        if (settings.provider) globalThis.window.localStorage.setItem("sim-provider", settings.provider);
        if (settings.apiKey) globalThis.window.localStorage.setItem("sim-api-key", settings.apiKey);
        if (settings.model) globalThis.window.localStorage.setItem("sim-model", settings.model);
      }
      return { aiSettings: newSettings };
    }),

  setProject: (projectId) => set({ projectId }),
  setBranch: (branchId) => set({ branchId }),
  setWorldState: (state) =>
    set((prev) => {
      const selectedAgent = prev.selectedAgentId
        ? state.agents.find((a) => a.id === prev.selectedAgentId) ?? null
        : null;
      return { worldState: state, selectedAgent };
    }),
  applyDelta: (delta) =>
    set((prev) => {
      if (!prev.worldState) return prev;
      
      const newAgents = prev.worldState.agents
        .map(a => {
          const updated = delta.changedAgents.find(ca => ca.id === a.id);
          return updated ?? a;
        });
      
      const newRelationships = prev.worldState.relationships.map(r => {
        const updated = delta.changedRelationships.find(cr => cr.id === r.id);
        return updated ?? r;
      });

      const newEvents = [...prev.worldState.events, ...delta.newEvents].slice(-50);

      const newState: WorldState = {
        ...prev.worldState,
        tick: delta.tick,
        seed: delta.seed,
        agents: newAgents,
        relationships: newRelationships,
        events: newEvents,
      };

      const selectedAgent = prev.selectedAgentId
        ? newAgents.find((a) => a.id === prev.selectedAgentId) ?? null
        : null;

      return { worldState: newState, selectedAgent };
    }),
  setBranches: (branches) => set({ branches }),
  setSelectedAgent: (agentId) =>
    set((prev) => {
      const selectedAgent = agentId && prev.worldState
        ? prev.worldState.agents.find((a) => a.id === agentId) ?? null
        : null;
      return { selectedAgentId: agentId, selectedAgent };
    }),
  setStatus: (status) => set({ status }),
  setTickSpeed: (speed) => set({ tickSpeed: speed }),
  addEvents: (events) =>
    set((prev) => ({
      recentEvents: [...prev.recentEvents, ...events].slice(-100),
    })),
  setLastProposals: (proposals) => set({ lastProposals: proposals }),
  setProjections: (projections) => set({ projections }),
  setShowProjections: (show) => set({ showProjections: show }),
  sync: async () => {
    const { branchId, worldState, setWorldState, setBranches, projectId } = get();
    if (!branchId || !projectId) return;
    try {
      const res = await fetch(`/api/branches/detail?id=${branchId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.branch && data.branch.currentTick > (worldState?.tick ?? 0)) {
        setWorldState(data.branch.latestState);
        const bRes = await fetch(`/api/branches?projectId=${projectId}`);
        const bData = await bRes.json();
        if (bData.branches) setBranches(bData.branches);
      }
    } catch (err) {
      console.error("[Sync] Heartbeat error:", err);
    }
  },

  currentTick: () => get().worldState?.tick ?? 0,
  aliveAgentCount: () =>
    get().worldState?.agents.filter((a) => a.status === "alive").length ?? 0,
}));
