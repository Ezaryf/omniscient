"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useSimulationStore,
  type AiSettings,
  type WorkspaceSettings,
} from "@/lib/stores/simulation-store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection =
  | "appearance"
  | "layout"
  | "map"
  | "timeline"
  | "simulation"
  | "ai";

type WorkspaceSettingsPatch = {
  appearance?: Partial<WorkspaceSettings["appearance"]>;
  layout?: Partial<WorkspaceSettings["layout"]>;
  map?: Partial<WorkspaceSettings["map"]>;
  timeline?: Partial<WorkspaceSettings["timeline"]>;
  simulation?: Partial<WorkspaceSettings["simulation"]>;
};

const PROVIDER_MODELS: Record<AiSettings["provider"], string[]> = {
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  gemini: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  ollama: ["llama3", "mistral", "phi3", "custom"],
};

const fieldLabelClassName =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]";
const selectClassName =
  "h-11 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-white/18 focus:ring-2 focus:ring-white/8";

const sections: { id: SettingsSection; title: string; description: string }[] = [
  { id: "appearance", title: "Appearance", description: "Density, text scale, corners, and motion." },
  { id: "layout", title: "Layout", description: "Dock widths, snapping, and reset controls." },
  { id: "map", title: "Map", description: "Label density, overlays, and route labeling." },
  { id: "timeline", title: "Timeline", description: "Event scale, rail density, and projection cards." },
  { id: "simulation", title: "Simulation", description: "Tick speed and branch / consequence defaults." },
  { id: "ai", title: "AI", description: "Provider, model, API key, and validation." },
];

function cloneSettings(settings: WorkspaceSettings) {
  return JSON.parse(JSON.stringify(settings)) as WorkspaceSettings;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    aiSettings,
    workspaceSettings,
    setAiSettings,
    setWorkspaceSettings,
    resetWorkspaceSettings,
  } = useSimulationStore();
  const [localAiSettings, setLocalAiSettings] = useState<AiSettings>(aiSettings);
  const [localSettings, setLocalSettings] = useState<WorkspaceSettings>(workspaceSettings);
  const [activeSection, setActiveSection] = useState<SettingsSection>("appearance");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLocalAiSettings(aiSettings);
    setLocalSettings(cloneSettings(workspaceSettings));
    setValidationResult(null);
    setActiveSection("appearance");
  }, [aiSettings, isOpen, workspaceSettings]);

  const handleSave = () => {
    setWorkspaceSettings(localSettings);
    setAiSettings(localAiSettings);
    onClose();
  };

  const handleReset = () => {
    resetWorkspaceSettings();
    setLocalSettings(cloneSettings(useSimulationStore.getState().workspaceSettings));
  };

  const validateKey = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/sim/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: localAiSettings.provider,
          apiKey: localAiSettings.apiKey,
        }),
      });
      const data = await res.json();
      setValidationResult({
        success: data.success,
        message: data.message || (data.success ? "Key is valid." : "Invalid API key."),
      });
    } catch {
      setValidationResult({ success: false, message: "Validation service unavailable." });
    } finally {
      setIsValidating(false);
    }
  };

  const updateSettings = (patch: WorkspaceSettingsPatch) => {
    setLocalSettings((current) => ({
      appearance: { ...current.appearance, ...patch.appearance },
      layout: { ...current.layout, ...patch.layout },
      map: { ...current.map, ...patch.map },
      timeline: { ...current.timeline, ...patch.timeline },
      simulation: { ...current.simulation, ...patch.simulation },
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1040px] overflow-hidden p-0">
        <DialogHeader className="border-b border-[var(--border-subtle)] bg-[var(--bg-dock)]/95">
          <div className="space-y-2">
            <Badge variant="accent" className="w-fit">
              Workspace Settings
            </Badge>
            <DialogTitle>Command center controls</DialogTitle>
            <DialogDescription>
              Tune the visual density, dock behavior, map detail, timeline behavior, simulation defaults,
              and AI configuration from one place.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid min-h-[680px] grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-r border-[var(--border-subtle)] bg-[var(--bg-dock)]/88 p-4">
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition",
                    activeSection === section.id
                      ? "border-[var(--border-strong)] bg-[var(--bg-panel)] text-[var(--text-primary)]"
                      : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-elevated)]"
                  )}
                >
                  <div className="text-sm font-semibold">{section.title}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                    {section.description}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="overflow-y-auto p-6">
            {activeSection === "appearance" ? (
              <div className="grid gap-6">
                <SectionIntro
                  title="Appearance"
                  copy="Soften the workspace without losing information density."
                />
                <SettingsGrid>
                  <SelectField
                    label="Density"
                    value={localSettings.appearance.density}
                    onChange={(value) =>
                      updateSettings({ appearance: { density: value as WorkspaceSettings["appearance"]["density"] } })
                    }
                    options={[
                      ["comfortable", "Comfortable"],
                      ["compact", "Compact"],
                    ]}
                  />
                  <SelectField
                    label="Contrast"
                    value={localSettings.appearance.contrast}
                    onChange={(value) =>
                      updateSettings({ appearance: { contrast: value as WorkspaceSettings["appearance"]["contrast"] } })
                    }
                    options={[
                      ["soft", "Soft"],
                      ["normal", "Normal"],
                    ]}
                  />
                  <SelectField
                    label="Corner Radius"
                    value={localSettings.appearance.cornerRadius}
                    onChange={(value) =>
                      updateSettings({ appearance: { cornerRadius: value as WorkspaceSettings["appearance"]["cornerRadius"] } })
                    }
                    options={[
                      ["soft", "Soft"],
                      ["tight", "Tight"],
                    ]}
                  />
                  <SelectField
                    label="Text Scale"
                    value={localSettings.appearance.textScale}
                    onChange={(value) =>
                      updateSettings({ appearance: { textScale: value as WorkspaceSettings["appearance"]["textScale"] } })
                    }
                    options={[
                      ["sm", "Small"],
                      ["md", "Medium"],
                      ["lg", "Large"],
                    ]}
                  />
                  <SelectField
                    label="Icon Scale"
                    value={localSettings.appearance.iconScale}
                    onChange={(value) =>
                      updateSettings({ appearance: { iconScale: value as WorkspaceSettings["appearance"]["iconScale"] } })
                    }
                    options={[
                      ["sm", "Small"],
                      ["md", "Medium"],
                      ["lg", "Large"],
                    ]}
                  />
                </SettingsGrid>
                <ToggleField
                  label="Reduced Motion"
                  copy="Calm down animated transitions, hover amplification, and any unnecessary movement."
                  checked={localSettings.appearance.reducedMotion}
                  onChange={(checked) => updateSettings({ appearance: { reducedMotion: checked } })}
                />
              </div>
            ) : null}

            {activeSection === "layout" ? (
              <div className="grid gap-6">
                <SectionIntro
                  title="Layout"
                  copy="Control the dock model directly instead of fighting hardcoded panel widths."
                />
                <SettingsGrid>
                  <NumberField
                    label="Left Dock Width"
                    value={localSettings.layout.leftWidth}
                    min={248}
                    max={520}
                    onChange={(value) => updateSettings({ layout: { leftWidth: value } })}
                  />
                  <NumberField
                    label="Right Dock Width"
                    value={localSettings.layout.rightWidth}
                    min={280}
                    max={560}
                    onChange={(value) => updateSettings({ layout: { rightWidth: value } })}
                  />
                  <NumberField
                    label="Timeline Height"
                    value={localSettings.layout.timelineHeight}
                    min={190}
                    max={440}
                    onChange={(value) => updateSettings({ layout: { timelineHeight: value } })}
                  />
                </SettingsGrid>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleField
                    label="Snap Dividers"
                    copy="Enable IDE-style snap points and cleaner docking landings while dragging."
                    checked={localSettings.layout.snap}
                    onChange={(checked) => updateSettings({ layout: { snap: checked } })}
                  />
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">Reset workspace layout</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      Restore default widths, heights, and panel visibility if the current dock state feels broken.
                    </p>
                    <Button className="mt-4" variant="outline" size="sm" type="button" onClick={handleReset}>
                      Reset layout
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "map" ? (
              <div className="grid gap-6">
                <SectionIntro title="Map View" copy="Make the center stage quieter and easier to parse." />
                <SettingsGrid>
                  <SelectField
                    label="Label Density"
                    value={localSettings.map.labelDensity}
                    onChange={(value) =>
                      updateSettings({ map: { labelDensity: value as WorkspaceSettings["map"]["labelDensity"] } })
                    }
                    options={[
                      ["minimal", "Minimal"],
                      ["balanced", "Balanced"],
                      ["dense", "Dense"],
                    ]}
                  />
                  <SelectField
                    label="Front Overlay Intensity"
                    value={localSettings.map.frontOverlayIntensity}
                    onChange={(value) =>
                      updateSettings({
                        map: {
                          frontOverlayIntensity:
                            value as WorkspaceSettings["map"]["frontOverlayIntensity"],
                        },
                      })
                    }
                    options={[
                      ["low", "Low"],
                      ["medium", "Medium"],
                      ["high", "High"],
                    ]}
                  />
                </SettingsGrid>
                <div className="grid gap-3 md:grid-cols-2">
                  <ToggleField
                    label="Show Route Labels"
                    copy="Keep route names visible on the map instead of moving them fully into the inspector."
                    checked={localSettings.map.showRouteLabels}
                    onChange={(checked) => updateSettings({ map: { showRouteLabels: checked } })}
                  />
                  <ToggleField
                    label="Show Projections by Default"
                    copy="Turn Omni-Vision projections on automatically when a timeline loads."
                    checked={localSettings.map.projectionsDefault}
                    onChange={(checked) => updateSettings({ map: { projectionsDefault: checked } })}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === "timeline" ? (
              <div className="grid gap-6">
                <SectionIntro title="Timeline View" copy="Compress or expand the rail without making it noisy." />
                <SettingsGrid>
                  <SelectField
                    label="Timeline Density"
                    value={localSettings.timeline.density}
                    onChange={(value) =>
                      updateSettings({ timeline: { density: value as WorkspaceSettings["timeline"]["density"] } })
                    }
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                    ]}
                  />
                  <SelectField
                    label="Event Marker Scale"
                    value={localSettings.timeline.eventScale}
                    onChange={(value) =>
                      updateSettings({ timeline: { eventScale: value as WorkspaceSettings["timeline"]["eventScale"] } })
                    }
                    options={[
                      ["sm", "Small"],
                      ["md", "Medium"],
                      ["lg", "Large"],
                    ]}
                  />
                  <NumberField
                    label="Projection Cards"
                    value={localSettings.timeline.projectionCards}
                    min={1}
                    max={8}
                    onChange={(value) => updateSettings({ timeline: { projectionCards: value } })}
                  />
                </SettingsGrid>
              </div>
            ) : null}

            {activeSection === "simulation" ? (
              <div className="grid gap-6">
                <SectionIntro title="Simulation Defaults" copy="Set the tempo and authoring defaults for new actions." />
                <SettingsGrid>
                  <NumberField
                    label="Tick Speed (ms)"
                    value={localSettings.simulation.tickSpeed}
                    min={250}
                    max={5000}
                    step={50}
                    onChange={(value) => updateSettings({ simulation: { tickSpeed: value } })}
                  />
                  <InputField
                    label="Branch Prefix"
                    value={localSettings.simulation.branchPrefix}
                    onChange={(value) => updateSettings({ simulation: { branchPrefix: value } })}
                    placeholder="Fork"
                  />
                  <SelectField
                    label="Default Event Type"
                    value={localSettings.simulation.defaultEventType}
                    onChange={(value) =>
                      updateSettings({
                        simulation: { defaultEventType: value as WorkspaceSettings["simulation"]["defaultEventType"] },
                      })
                    }
                    options={[
                      ["injected", "Injected"],
                      ["conflict", "Conflict"],
                      ["negotiation", "Negotiation"],
                      ["trade", "Trade"],
                      ["rule_change", "Rule Change"],
                    ]}
                  />
                </SettingsGrid>
                <ToggleField
                  label="Autoplay On Launch"
                  copy="Start the simulation immediately after entering a timeline."
                  checked={localSettings.simulation.autoplayOnLaunch}
                  onChange={(checked) => updateSettings({ simulation: { autoplayOnLaunch: checked } })}
                />
              </div>
            ) : null}

            {activeSection === "ai" ? (
              <div className="grid gap-6">
                <SectionIntro
                  title="AI Configuration"
                  copy="Control provider, model, and validation for setup drafting and consequence generation."
                />
                <SettingsGrid>
                  <SelectField
                    label="AI Provider"
                    value={localAiSettings.provider}
                    onChange={(value) => {
                      const provider = value as AiSettings["provider"];
                      setLocalAiSettings({
                        ...localAiSettings,
                        provider,
                        model: PROVIDER_MODELS[provider][0],
                      });
                    }}
                    options={[
                      ["openai", "OpenAI"],
                      ["gemini", "Google Gemini"],
                      ["anthropic", "Anthropic"],
                      ["groq", "Groq"],
                      ["ollama", "Ollama"],
                    ]}
                  />
                  <SelectField
                    label="Model"
                    value={localAiSettings.model}
                    onChange={(value) => setLocalAiSettings({ ...localAiSettings, model: value })}
                    options={PROVIDER_MODELS[localAiSettings.provider].map((model) => [model, model])}
                  />
                </SettingsGrid>
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="api-key-input" className={fieldLabelClassName}>
                      API Key
                    </label>
                    {validationResult ? (
                      <Badge variant={validationResult.success ? "success" : "danger"}>
                        {validationResult.success ? "Validated" : "Needs attention"}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex gap-3">
                    <Input
                      id="api-key-input"
                      type="password"
                      placeholder={`Enter ${localAiSettings.provider} API key`}
                      value={localAiSettings.apiKey}
                      onChange={(event) =>
                        setLocalAiSettings({ ...localAiSettings, apiKey: event.target.value })
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={validateKey}
                      disabled={isValidating || !localAiSettings.apiKey}
                      className="h-11 min-w-[100px]"
                    >
                      {isValidating ? "Checking..." : "Validate"}
                    </Button>
                  </div>
                  {validationResult ? (
                    <p
                      className={cn(
                        "text-sm",
                        validationResult.success ? "text-[#9ed0ad]" : "text-[#efb0b0]"
                      )}
                    >
                      {validationResult.message}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="bg-[var(--bg-dock)]/92">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="outline" onClick={handleReset} type="button">
            Reset all
          </Button>
          <Button variant="primary" onClick={handleSave} type="button">
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionIntro({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</div>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">{copy}</p>
    </div>
  );
}

function SettingsGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <section className="grid gap-2">
      <label className={fieldLabelClassName}>{label}</label>
      <select className={selectClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <section className="grid gap-2">
      <label className={fieldLabelClassName}>{label}</label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number.parseInt(event.target.value || String(min), 10))}
      />
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <section className="grid gap-2">
      <label className={fieldLabelClassName}>{label}</label>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </section>
  );
}

function ToggleField({
  label,
  copy,
  checked,
  onChange,
}: {
  label: string;
  copy: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] p-4">
      <div>
        <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{copy}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-1 h-7 w-12 rounded-full border transition",
          checked
            ? "border-white/18 bg-white/18"
            : "border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-[var(--text-primary)] transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
}
