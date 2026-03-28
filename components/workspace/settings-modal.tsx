"use client";

import { useState, useEffect } from "react";
import { useSimulationStore, type AiSettings } from "@/lib/stores/simulation-store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROVIDER_MODELS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-1.0-pro"],
  groq: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768"],
  ollama: ["llama3", "mistral", "phi3", "custom"],
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { aiSettings, setAiSettings } = useSimulationStore();
  const [localSettings, setLocalSettings] = useState<AiSettings>(aiSettings);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setLocalSettings(aiSettings);
  }, [aiSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setAiSettings(localSettings);
    onClose();
  };

  const validateKey = async () => {
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/sim/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: localSettings.provider,
          apiKey: localSettings.apiKey,
        }),
      });
      const data = await res.json();
      setValidationResult({
        success: data.success,
        message: data.message || (data.success ? "Key is valid!" : "Invalid API key."),
      });
    } catch (err) {
      setValidationResult({ success: false, message: "Validation service unavailable." });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-elevated" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Simulation Settings</h2>
          <button className="btn-close" onClick={onClose} type="button">
            &times;
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <label htmlFor="provider-select">AI Provider</label>
            <select
              id="provider-select"
              value={localSettings.provider}
              onChange={(e) => {
                const provider = e.target.value as AiSettings["provider"];
                setLocalSettings({ 
                  ...localSettings, 
                  provider, 
                  model: PROVIDER_MODELS[provider][0] 
                });
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="groq">Groq (Llama3/Mixtral)</option>
              <option value="ollama">Ollama (Local)</option>
            </select>
          </section>

          <section className="settings-section">
            <label htmlFor="api-key-input">API Key</label>
            <div className="input-with-action">
              <input
                id="api-key-input"
                type="password"
                placeholder={`Enter ${localSettings.provider} API key`}
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
              />
              <button 
                className="btn btn-sm btn-outline" 
                onClick={validateKey}
                disabled={isValidating || !localSettings.apiKey}
                type="button"
              >
                {isValidating ? "..." : "Validate"}
              </button>
            </div>
            {validationResult && (
              <p className={`validation-msg ${validationResult.success ? "success" : "error"}`}>
                {validationResult.success ? "✓" : "✗"} {validationResult.message}
              </p>
            )}
          </section>

          <section className="settings-section">
            <label htmlFor="model-select">Model Selection</label>
            <select
              id="model-select"
              value={localSettings.model}
              onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
            >
              {PROVIDER_MODELS[localSettings.provider].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </section>
        </div>

        <footer className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} type="button">
            Save Changes
          </button>
        </footer>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-content {
          width: 100%;
          max-width: 440px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          animation: modal-in 0.2s ease-out;
        }
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .modal-header {
          padding: var(--space-lg);
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-subtle);
        }
        .modal-header h2 { font-size: 1.125rem; }
        .btn-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: var(--text-muted);
        }
        .modal-body {
          padding: var(--space-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }
        .settings-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }
        .settings-section label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input-with-action {
          display: flex;
          gap: var(--space-xs);
        }
        input, select {
          flex: 1;
          background: var(--bg-elevated);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-sm);
          color: var(--text-primary);
          outline: none;
        }
        input:focus, select:focus { border-color: var(--accent-primary); }
        .validation-msg {
          font-size: 0.75rem;
          margin-top: 4px;
        }
        .validation-msg.success { color: #10b981; }
        .validation-msg.error { color: #ef4444; }
        .modal-footer {
          padding: var(--space-lg);
          background: rgba(0, 0, 0, 0.2);
          display: flex;
          justify-content: flex-end;
          gap: var(--space-sm);
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>
    </div>
  );
}
