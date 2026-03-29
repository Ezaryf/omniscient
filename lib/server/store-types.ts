import {
  ProjectRecord,
  ScenarioRecord,
} from "./store";
import {
  TimelineBranch,
  Snapshot,
  SimEvent,
  ExplanationArtifact,
} from "@/lib/sim/types";

export interface SimulationStore {
  // Projects
  getProject(id: string): Promise<ProjectRecord | null>;
  listProjects(): Promise<ProjectRecord[]>;
  saveProject(project: ProjectRecord): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // Scenarios
  getScenario(id: string): Promise<ScenarioRecord | null>;
  saveScenario(scenario: ScenarioRecord): Promise<void>;

  // Branches
  getBranch(id: string): Promise<TimelineBranch | null>;
  listBranches(projectId: string): Promise<TimelineBranch[]>;
  saveBranch(branch: TimelineBranch): Promise<void>;

  // Snapshots
  getSnapshot(id: string): Promise<Snapshot | null>;
  listSnapshots(branchId: string): Promise<Snapshot[]>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;
  deleteSnapshots(ids: string[]): Promise<void>;

  // Events
  getEvents(branchId: string): Promise<SimEvent[]>;
  saveEvents(branchId: string, events: SimEvent[]): Promise<void>;

  // Explanations
  getExplanations(branchId: string): Promise<ExplanationArtifact[]>;
  saveExplanation(explanation: ExplanationArtifact): Promise<void>;

  // Proposal Ledger (Determinism)
  getProposals(branchId: string, tick: number): Promise<any | null>;
  saveProposals(branchId: string, tick: number, proposals: any): Promise<void>;
  checkBranchOwnership(branchId: string, userId: string): Promise<boolean>;
}
