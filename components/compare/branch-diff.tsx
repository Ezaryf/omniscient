"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisCard } from "@/lib/sim/analysis";
import type {
  AgentStateDiff,
  ConsequenceContrast,
  FrontStateDiff,
  RouteStateDiff,
} from "@/lib/sim/branch";
import type { SimEvent } from "@/lib/sim/types";

interface BranchDiffProps {
  readonly branchA: { id: string; name: string; tick: number };
  readonly branchB: { id: string; name: string; tick: number };
  readonly divergence: {
    readonly commonAncestorTick: number;
    readonly divergencePointTick: number;
    readonly agentDiffs: AgentStateDiff[];
    readonly frontDiffs: FrontStateDiff[];
    readonly routeDiffs: RouteStateDiff[];
    readonly contrasts: ConsequenceContrast[];
    readonly branchAEvents: SimEvent[];
    readonly branchBEvents: SimEvent[];
  };
  readonly workbench?: {
    readonly overview: AnalysisCard[];
    readonly uniqueEventsA: SimEvent[];
    readonly uniqueEventsB: SimEvent[];
  };
}

export function BranchDiff({ branchA, branchB, divergence, workbench }: BranchDiffProps) {
  const hasDivergence =
    divergence.agentDiffs.length > 0 ||
    divergence.frontDiffs.length > 0 ||
    divergence.routeDiffs.length > 0 ||
    divergence.contrasts.length > 0;

  return (
    <div className="grid gap-5">
      <Card className="bg-[var(--bg-dock)]/92">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <BranchBadge name={branchA.name} tick={branchA.tick} variant="accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              versus
            </span>
            <BranchBadge name={branchB.name} tick={branchB.tick} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Shared history until T{divergence.commonAncestorTick}</Badge>
            <Badge variant="accent">
              {divergence.agentDiffs.length + divergence.frontDiffs.length + divergence.routeDiffs.length} tracked deltas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {workbench?.overview?.length ? (
        <section className="grid gap-3">
          <SectionHeading title="Divergence workbench" />
          <div className="grid gap-3 xl:grid-cols-2">
            {workbench.overview.map((card) => (
              <AnalysisCardView key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}

      {hasDivergence ? (
        <section className="grid gap-3">
          <SectionHeading title="Key consequences" />
          <div className="grid gap-3 xl:grid-cols-2">
            {divergence.contrasts.map((contrast) => (
              <Card key={contrast.title}>
                <CardHeader className="pb-2">
                  <CardTitle>{contrast.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {contrast.summary}
                  </p>
                  <ul className="grid gap-2">
                    {contrast.evidence.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2 text-sm text-[var(--text-secondary)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : (
        <Card className="border-[var(--border-strong)] bg-[var(--bg-dock)]/94">
          <CardHeader>
            <Badge variant="success" className="w-fit">
              No divergence yet
            </Badge>
            <CardTitle>These branches are still narratively aligned</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="max-w-[72ch] text-sm leading-6 text-[var(--text-secondary)]">
              Nothing meaningful has split between these timelines yet. Run additional ticks, inject
              a consequence, or branch from a more volatile event to surface a sharper contrast.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Shared until" value={`T${divergence.commonAncestorTick}`} />
              <MetricCard label={branchA.name} value={`${divergence.branchAEvents.length} events`} />
              <MetricCard label={branchB.name} value={`${divergence.branchBEvents.length} events`} />
            </div>
          </CardContent>
        </Card>
      )}

      {divergence.frontDiffs.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading title="Front divergence" />
          <div className="grid gap-3 xl:grid-cols-2">
            {divergence.frontDiffs.map((front) => (
              <Card key={front.frontId}>
                <CardHeader className="pb-2">
                  <CardTitle>{front.frontName}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-[var(--text-secondary)]">
                  <MetricRow
                    label={branchA.name}
                    value={`${Math.round(front.progressA * 100)} progress | ${Math.round(front.pressureA * 100)} pressure`}
                  />
                  <MetricRow
                    label={branchB.name}
                    value={`${Math.round(front.progressB * 100)} progress | ${Math.round(front.pressureB * 100)} pressure`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {divergence.routeDiffs.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading title="Route consequences" />
          <div className="grid gap-3 xl:grid-cols-2">
            {divergence.routeDiffs.map((route) => (
              <Card key={route.routeId}>
                <CardHeader className="pb-2">
                  <CardTitle>{route.routeName}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-[var(--text-secondary)]">
                  <MetricRow
                    label={branchA.name}
                    value={`${route.statusA} | ${Math.round(route.integrityA * 100)} integrity | ${Math.round(route.riskA * 100)} risk`}
                  />
                  <MetricRow
                    label={branchB.name}
                    value={`${route.statusB} | ${Math.round(route.integrityB * 100)} integrity | ${Math.round(route.riskB * 100)} risk`}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {divergence.agentDiffs.length > 0 ? (
        <section className="grid gap-3">
          <SectionHeading title="Actor state changes" />
          <div className="grid gap-3">
            {divergence.agentDiffs.map((diff) => (
              <Card key={diff.agentId}>
                <CardHeader className="pb-2">
                  <CardTitle>{diff.agentName}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {diff.diffs.map((field) => (
                    <div
                      key={field.field}
                      className="grid grid-cols-[88px_1fr] gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2 text-sm md:grid-cols-[88px_80px_28px_80px_1fr]"
                    >
                      <span className="text-[var(--text-secondary)]">{field.field}</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {field.valueA.toFixed(1)}
                      </span>
                      <span className="hidden text-[var(--text-muted)] md:inline">-&gt;</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {field.valueB.toFixed(1)}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {field.delta > 0 ? "+" : ""}
                        {field.delta.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <EventColumn
          branch={branchA.name}
          events={workbench?.uniqueEventsA?.length ? workbench.uniqueEventsA : divergence.branchAEvents}
          helperLabel="unique consequences"
        />
        <EventColumn
          branch={branchB.name}
          events={workbench?.uniqueEventsB?.length ? workbench.uniqueEventsB : divergence.branchBEvents}
          helperLabel="unique consequences"
        />
      </div>
    </div>
  );
}

function AnalysisCardView({ card }: { card: AnalysisCard }) {
  const badgeVariant =
    card.tone === "warning"
      ? "warning"
      : card.tone === "accent"
        ? "accent"
        : card.tone === "success"
          ? "success"
          : "default";

  return (
    <Card className="bg-[var(--bg-panel)]/92">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{card.title}</CardTitle>
          <Badge variant={badgeVariant}>{Math.round(card.confidence * 100)}%</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{card.summary}</p>
        {card.evidence.length > 0 ? (
          <ul className="grid gap-2">
            {card.evidence.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BranchBadge({
  name,
  tick,
  variant,
}: {
  name: string;
  tick: number;
  variant?: "accent" | "default";
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-panel)] px-3 py-2">
      <Badge variant={variant === "accent" ? "accent" : "default"}>{name}</Badge>
      <span className="font-mono text-xs text-[var(--text-muted)]">T{tick}</span>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
      {title}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-4 py-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-base font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

function EventColumn({
  branch,
  events,
  helperLabel,
}: {
  readonly branch: string;
  readonly events: SimEvent[];
  readonly helperLabel?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{branch}</CardTitle>
          <Badge>{events.length} {helperLabel ?? "events"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {events.slice(0, 15).map((event) => (
          <div
            key={event.id}
            className="grid gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/68 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-[var(--text-muted)]">T{event.tick}</span>
              {event.causedBy.length > 0 ? <Badge>{event.causedBy.length} parents</Badge> : null}
            </div>
            <div className="text-sm leading-6 text-[var(--text-secondary)]">
              {event.description}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
