"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import {
  startBrowserSession,
  browserStreamUrl,
} from "@/lib/browser-sse";
import { MemoryChip } from "./memory-chip";
import type { LaneCompletion } from "@/lib/lane-completion";

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
  onComplete?: (completion: LaneCompletion) => void;
}

export function BrowserLane({
  caseId,
  merchantName,
  autoStart = false,
  onComplete,
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
            // Notify parent of terminal state
            const elapsedFinal = startedAtRef.current
              ? Math.floor((Date.now() - startedAtRef.current) / 1000)
              : 0;
            onComplete?.({
              caseId,
              merchant: merchantName,
              channel: "browser",
              status: "success",
              durationSeconds: elapsedFinal,
              sessionId: session.session_id,
              output: data.output || undefined,
              completedAt: new Date().toISOString(),
            });
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

  const isIdle = status === "idle";
  const showIframeArea = !isIdle && status !== "error";

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header — prose */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Globe size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[14px] font-semibold truncate">
            {merchantName}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="text-[12px] text-muted-foreground">
            {statusLabel(status)}
          </span>
          <MemoryChip merchantId="nyt" />
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground flex-shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Live iframe view — only when running */}
      {showIframeArea && (
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {liveUrl ? (
            <iframe
              src={liveUrl}
              className="w-full h-full border-0"
              allow="autoplay; clipboard-read; clipboard-write"
              title="Browser Use live session"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-[12px]">
              {status === "starting" ? "Provisioning browser…" : ""}
            </div>
          )}
          {currentStep && (
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-black/80 backdrop-blur text-[12px] text-foreground/90 border-t border-border">
              <span className="text-muted-foreground">
                step {currentStep.step_index}:
              </span>{" "}
              {currentStep.summary.slice(0, 140)}
              {currentStep.summary.length > 140 ? "…" : ""}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="px-5 py-2.5 text-[13px] text-destructive border-b border-border">
            {error}
          </div>
        )}

        {/* Pre-execution preview */}
        {isIdle && (
          <div className="px-5 py-5 space-y-3">
            <PreExecRow label="Will navigate">
              nytimes.com cancellation flow via real headless browser
            </PreExecRow>
            <PreExecRow label="Stops at">
              chat handoff (non-destructive — no real cancellation)
            </PreExecRow>
            <PreExecRow label="Expected">
              ~3m based on prior runs · live screen visible once started
            </PreExecRow>
          </div>
        )}

        {canStart && !autoStart && (
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={handleStart}
              className="w-full py-2.5 rounded-md text-[14px] font-medium bg-foreground text-background hover:opacity-90"
            >
              {isCompleted ? "Run again" : "Approve & run"}
            </button>
          </div>
        )}

        {steps.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1 text-[12px] max-h-[200px] border-t border-border">
            {steps.map((s) => (
              <div
                key={s.step_index}
                className="text-muted-foreground leading-relaxed"
              >
                <span className="text-foreground/80 tabular-nums">
                  {s.step_index.toString().padStart(2, " ")}
                </span>{" "}
                {s.summary.slice(0, 200)}
                {s.summary.length > 200 ? "…" : ""}
              </div>
            ))}
          </div>
        )}

        {isCompleted && output && (
          <div className="px-5 py-4 border-t border-border bg-accent/5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-accent mb-1.5">
              Result
            </div>
            <div className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">
              {output.slice(0, 400)}
              {output.length > 400 ? "…" : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: LaneStatus): string {
  switch (status) {
    case "idle":
      return "Ready";
    case "starting":
      return "Starting…";
    case "running":
      return "Live";
    case "completed":
      return "Confirmed";
    case "error":
      return "Failed";
  }
}

function PreExecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70 w-24 flex-shrink-0">
        {label}
      </span>
      <span className="text-[13px] text-foreground/90 leading-relaxed">
        {children}
      </span>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
