"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import {
  startBrowserSession,
  browserStreamUrl,
} from "@/lib/browser-sse";
import { MemoryChip } from "./memory-chip";

interface BrowserStep {
  step_index: number;
  role: string;
  msg_type: string;
  summary: string;
  screenshot_url?: string;
}

type LaneStatus =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "error";

interface BrowserLaneProps {
  caseId: string;
  merchantName: string;
  autoStart?: boolean;
}

export function BrowserLane({
  caseId,
  merchantName,
  autoStart = false,
}: BrowserLaneProps) {
  const [status, setStatus] = useState<LaneStatus>("idle");
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [steps, setSteps] = useState<BrowserStep[]>([]);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    setSteps([]);
    setOutput(null);
    setLiveUrl(null);
    setStatus("starting");
    startedAtRef.current = Date.now();
    setElapsed(0);

    tickerRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);

    try {
      const session = await startBrowserSession(caseId);
      setLiveUrl(session.live_url);
      setStatus("running");

      const es = new EventSource(browserStreamUrl(session.session_id));
      eventSourceRef.current = es;

      es.onopen = () => console.log("[browser-lane] SSE open", session.session_id);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "connected") {
            if (data.live_url) setLiveUrl(data.live_url);
          } else if (data.type === "step") {
            setSteps((prev) => [...prev, data as BrowserStep]);
          } else if (data.type === "ended") {
            setStatus("completed");
            if (data.output) setOutput(data.output);
            if (tickerRef.current) {
              clearInterval(tickerRef.current);
              tickerRef.current = null;
            }
            es.close();
          }
        } catch {
          // Non-JSON heartbeat or unknown; ignore
        }
      };

      es.onerror = (err) => {
        console.warn("[browser-lane] SSE error (browser will auto-reconnect)", err);
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
      setStatus("error");
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }
  }, [caseId]);

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart && status === "idle") {
      handleStart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const isLive = status === "running";
  const isCompleted = status === "completed";
  const canStart = status === "idle" || status === "completed" || status === "error";

  const currentStep =
    steps.length > 0
      ? steps[steps.length - 1]
      : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-[var(--surface)]">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Globe size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[14px] font-semibold truncate">{merchantName}</span>
          <StatusPill status={status} />
          <MemoryChip merchantId="nyt" />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Live view */}
      <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
        {liveUrl ? (
          <iframe
            src={liveUrl}
            className="w-full h-full border-0"
            allow="autoplay; clipboard-read; clipboard-write"
            title="Browser Use live session"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-[13px]">
            {status === "idle" && "Ready"}
            {status === "starting" && "Provisioning browser..."}
            {status === "error" && "Failed to start"}
          </div>
        )}
        {/* Step overlay strip */}
        {currentStep && (
          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/80 backdrop-blur text-[12px] font-mono text-foreground border-t border-border">
            <span className="text-muted-foreground">
              step {currentStep.step_index} · {currentStep.msg_type}:
            </span>{" "}
            {currentStep.summary.slice(0, 120)}
            {currentStep.summary.length > 120 ? "…" : ""}
          </div>
        )}
      </div>

      {/* Step log + actions */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="px-4 py-2 text-[13px] text-destructive border-b border-border">
            {error}
          </div>
        )}

        {canStart && !autoStart && (
          <div className="px-4 py-3 border-b border-border">
            <button
              onClick={handleStart}
              className="w-full py-2 rounded-md text-[14px] font-medium bg-foreground text-background hover:opacity-90"
            >
              {isCompleted ? "Run Again" : "Approve & Run"}
            </button>
          </div>
        )}

        {steps.length > 0 && (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 text-[12px] font-mono max-h-[200px]">
            {steps.map((s) => (
              <div
                key={s.step_index}
                className="text-muted-foreground leading-relaxed"
              >
                <span className="text-foreground">[{s.step_index}]</span>{" "}
                <span className="text-accent">{s.role}/{s.msg_type}</span>:{" "}
                {s.summary.slice(0, 200)}
                {s.summary.length > 200 ? "…" : ""}
              </div>
            ))}
          </div>
        )}

        {isCompleted && output && (
          <div className="px-4 py-3 border-t border-border bg-accent/5">
            <div className="text-[11px] font-mono text-accent uppercase tracking-wide mb-1">
              ✓ Result
            </div>
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
              {output.slice(0, 400)}
              {output.length > 400 ? "…" : ""}
            </div>
          </div>
        )}

        {/* Honesty footer */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground bg-[var(--surface)]">
          Real Browser Use session navigating nytimes.com. Stops at chat
          handoff — does not complete cancellation.
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: LaneStatus }) {
  const config: Record<LaneStatus, { label: string; className: string }> = {
    idle: {
      label: "ready",
      className: "bg-[var(--surface-elevated)] text-muted-foreground",
    },
    starting: {
      label: "starting",
      className: "bg-amber-500/10 text-amber-500",
    },
    running: {
      label: "running",
      className: "bg-accent/10 text-accent animate-pulse",
    },
    completed: {
      label: "completed",
      className: "bg-accent/10 text-accent",
    },
    error: {
      label: "error",
      className: "bg-destructive/10 text-destructive",
    },
  };
  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${className}`}
    >
      {label}
    </span>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
