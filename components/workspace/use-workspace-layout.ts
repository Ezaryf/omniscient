"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WORKSPACE_SETTINGS, useSimulationStore } from "@/lib/stores/simulation-store";

const LEFT_PANEL_MIN = 248;
const LEFT_PANEL_MAX = 520;
const RIGHT_PANEL_MIN = 280;
const RIGHT_PANEL_MAX = 560;
const TIMELINE_MIN = 190;
const TIMELINE_MAX = 440;
const LEFT_SNAP_POINTS = [280, 320, 360, 420];
const RIGHT_SNAP_POINTS = [300, 340, 380, 440];
const TIMELINE_SNAP_POINTS = [220, 260, 320, 380];
const COLLAPSED_LEFT_WIDTH = 52;
const COLLAPSED_RIGHT_WIDTH = 52;
const COLLAPSED_TIMELINE_HEIGHT = 48;

type ResizeKind = "left" | "right" | "timeline";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snapValue(value: number, points: number[]) {
  const nearest = points.reduce((best, point) =>
    Math.abs(point - value) < Math.abs(best - value) ? point : best
  );
  return Math.abs(nearest - value) <= 18 ? nearest : value;
}

export function useWorkspaceLayout() {
  const { workspaceSettings, updateDockLayout } = useSimulationStore();
  const [hydrated, setHydrated] = useState(false);
  const layout = workspaceSettings.layout;
  const effectiveLayout = hydrated ? layout : DEFAULT_WORKSPACE_SETTINGS.layout;
  const resizeSessionRef = useRef<
    | {
        kind: ResizeKind;
        startX: number;
        startY: number;
        startLeft: number;
        startRight: number;
        startTimeline: number;
      }
    | null
  >(null);
  const animationFrameRef = useRef<number | null>(null);
  const pendingPositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const flushResize = useCallback(() => {
    const session = resizeSessionRef.current;
    const pending = pendingPositionRef.current;
    if (!session || !pending) return;

    if (session.kind === "left") {
      let nextWidth = clamp(
        session.startLeft + (pending.x - session.startX),
        LEFT_PANEL_MIN,
        LEFT_PANEL_MAX
      );
      if (layout.snap) nextWidth = snapValue(nextWidth, LEFT_SNAP_POINTS);
      updateDockLayout({
        leftCollapsed: false,
        leftWidth: nextWidth,
      });
    } else if (session.kind === "right") {
      let nextWidth = clamp(
        session.startRight - (pending.x - session.startX),
        RIGHT_PANEL_MIN,
        RIGHT_PANEL_MAX
      );
      if (layout.snap) nextWidth = snapValue(nextWidth, RIGHT_SNAP_POINTS);
      updateDockLayout({
        rightCollapsed: false,
        rightWidth: nextWidth,
      });
    } else {
      let nextHeight = clamp(
        session.startTimeline - (pending.y - session.startY),
        TIMELINE_MIN,
        TIMELINE_MAX
      );
      if (layout.snap) nextHeight = snapValue(nextHeight, TIMELINE_SNAP_POINTS);
      updateDockLayout({
        timelineCollapsed: false,
        timelineHeight: nextHeight,
      });
    }

    animationFrameRef.current = null;
  }, [layout.snap, updateDockLayout]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeSessionRef.current) return;
      pendingPositionRef.current = { x: event.clientX, y: event.clientY };
      if (animationFrameRef.current !== null) return;
      animationFrameRef.current = window.requestAnimationFrame(flushResize);
    };

    const handlePointerUp = () => {
      resizeSessionRef.current = null;
      pendingPositionRef.current = null;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [flushResize]);

  const beginResize = useCallback(
    (kind: ResizeKind, event: React.PointerEvent<HTMLDivElement>) => {
      resizeSessionRef.current = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: effectiveLayout.leftWidth,
        startRight: effectiveLayout.rightWidth,
        startTimeline: effectiveLayout.timelineHeight,
      };
      document.body.style.cursor = kind === "timeline" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [effectiveLayout.leftWidth, effectiveLayout.rightWidth, effectiveLayout.timelineHeight]
  );

  const toggleDock = useCallback(
    (kind: ResizeKind) => {
      if (kind === "left") {
        updateDockLayout({ leftCollapsed: !layout.leftCollapsed });
      } else if (kind === "right") {
        updateDockLayout({ rightCollapsed: !layout.rightCollapsed });
      } else {
        updateDockLayout({ timelineCollapsed: !layout.timelineCollapsed });
      }
    },
    [layout.leftCollapsed, layout.rightCollapsed, layout.timelineCollapsed, updateDockLayout]
  );

  const resetDock = useCallback(
    (kind: ResizeKind) => {
      if (kind === "left") {
        updateDockLayout({ leftCollapsed: false, leftWidth: 320 });
      } else if (kind === "right") {
        updateDockLayout({ rightCollapsed: false, rightWidth: 340 });
      } else {
        updateDockLayout({ timelineCollapsed: false, timelineHeight: 260 });
      }
    },
    [updateDockLayout]
  );

  const gridColumns = useMemo(() => {
    const left = effectiveLayout.leftCollapsed ? COLLAPSED_LEFT_WIDTH : effectiveLayout.leftWidth;
    const right = effectiveLayout.rightCollapsed ? COLLAPSED_RIGHT_WIDTH : effectiveLayout.rightWidth;
    // Slightly tighter gutters make the workspace feel calmer and less "scaffold-y".
    return `${left}px 8px minmax(0, 1fr) 8px ${right}px`;
  }, [effectiveLayout.leftCollapsed, effectiveLayout.leftWidth, effectiveLayout.rightCollapsed, effectiveLayout.rightWidth]);

  const timelineHeight = effectiveLayout.timelineCollapsed
    ? COLLAPSED_TIMELINE_HEIGHT
    : effectiveLayout.timelineHeight;

  return {
    hydrated,
    layout: effectiveLayout,
    gridColumns,
    timelineHeight,
    beginResize,
    toggleDock,
    resetDock,
  };
}
