"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NarrativeCardProps {
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  generatedBy: "ai" | "heuristic";
  tick?: number;
}

export function NarrativeCard({
  title,
  summary,
  evidence,
  confidence,
  generatedBy,
  tick,
}: NarrativeCardProps) {
  const confidenceWidth = Math.max(0, Math.min(100, confidence * 100));
  const confidenceTone =
    confidence > 0.7
      ? "bg-[#7dc08f]"
      : confidence > 0.4
        ? "bg-[var(--accent-primary)]"
        : "bg-[#d77d7d]";

  return (
    <Card className="h-full">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {tick !== undefined ? <Badge>T{tick}</Badge> : null}
            <Badge variant={generatedBy === "ai" ? "accent" : "default"}>
              {generatedBy === "ai" ? "AI signal" : "Heuristic signal"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{summary}</p>

        {evidence.length > 0 ? (
          <div className="grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Evidence
            </div>
            <ul className="grid gap-2">
              {evidence.map((item, index) => (
                <li
                  key={`evidence-${title}-${index}`}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2 text-sm text-[var(--text-secondary)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            <span>Confidence</span>
            <span className="font-mono text-[var(--text-primary)]">
              {confidenceWidth.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div className={`h-full rounded-full ${confidenceTone}`} style={{ width: `${confidenceWidth}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
