"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Phone } from "lucide-react";
import { TranscriptView, type TranscriptTurn } from "./transcript-view";
import { MemoryChip } from "./execute/memory-chip";
import { startCall, getCall, streamTranscriptUrl } from "@/lib/api";

// Hardcoded case data — Planet Fitness is the only wired case for Tier 0
const CASES: Record<
  string,
  { merchant: string; plan: string; monthly_cost: number; phone: string }
> = {
  sub_planet_fitness: {
    merchant: "Planet Fitness",
    plan: "Classic Membership",
    monthly_cost: 24.99,
    phone: "+16179358558",
  },
};

type CallStatus =
  | "idle"
  | "starting"
  | "ringing"
  | "in-progress"
  | "completed"
  | "failed";

export function CallPanel({ caseId }: { caseId: string }) {
  const caseData = CASES[caseId];
  const [status, setStatus] = useState<CallStatus>("idle");
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const finalizeFromCall = useCallback((call: Record<string, unknown>) => {
    const transcripts = (call.transcripts as Array<Record<string, unknown>>) || [];
    if (transcripts.length > 0) {
      const builtTurns: TranscriptTurn[] = [];
      for (const t of transcripts) {
        if (t.response) {
          builtTurns.push({ role: "agent", content: t.response as string });
        }
        if (t.transcript) {
          builtTurns.push({ role: "user", content: t.transcript as string });
        }
      }
      setTurns(builtTurns);
    }
    if (typeof call.durationSeconds === "number") {
      setDuration(call.durationSeconds);
    }
    if (typeof call.confirmation_number === "string") {
      setConfirmationNumber(call.confirmation_number);
    }
    setStatus("completed");
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (id: string) => {
      try {
        const call = await getCall(id);
        if (call.status === "completed") {
          finalizeFromCall(call);
          if (eventSourceRef.current) eventSourceRef.current.close();
          if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
        }
      } catch (err) {
        console.warn("[call-panel] poll error", err);
      }
    },
    [finalizeFromCall]
  );

  const handleStartCall = useCallback(async () => {
    if (!caseData) return;
    setError(null);
    setTurns([]);
    setDuration(null);
    setConfirmationNumber(null);
    setStatus("starting");
    startedAtRef.current = Date.now();
    setElapsed(0);
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);

    try {
      const result = await startCall(caseData.phone);
      setStatus(result.status === "ringing" ? "ringing" : "in-progress");

      const es = new EventSource(streamTranscriptUrl(result.call_id));
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log("[call-panel] SSE open", result.call_id);
      };

      es.onmessage = (event) => {
        console.log("[call-panel] SSE event", event.data);
        try {
          const data = JSON.parse(event.data);
          if (data.role && data.content) {
            setTurns((prev) => [
              ...prev,
              { role: data.role, content: data.content },
            ]);
            setStatus("in-progress");
          }
          if (data.status === "ended" || data.status === "completed") {
            // Final poll to grab confirmation_number which SSE doesn't carry.
            pollOnce(result.call_id);
          }
        } catch {
          // Non-JSON or non-transcript event, ignore
        }
      };

      // Don't close on error — browser auto-reconnects EventSource.
      // Just log and let it recover.
      es.onerror = (err) => {
        console.warn("[call-panel] SSE error (browser will auto-reconnect)", err);
      };

      // Safety net: if SSE hasn't reported the call ended within 5 minutes,
      // do a one-shot poll to finalize state. This is the ONLY fallback —
      // no parallel polling running during the call.
      safetyTimerRef.current = setTimeout(
        () => pollOnce(result.call_id),
        5 * 60 * 1000
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
      setStatus("failed");
    }
  }, [caseData, pollOnce]);

  if (!caseData) {
    return (
      <div className="text-center py-16 text-muted-foreground text-[13px]">
        Unknown case: {caseId}
      </div>
    );
  }

  const isLive = status === "ringing" || status === "in-progress";
  const isCompleted = status === "completed";
  const canStart = status === "idle" || status === "failed" || status === "completed";

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-[var(--surface)]">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Phone size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[14px] font-semibold truncate">{caseData.merchant}</span>
          <StatusPill status={status} />
          <MemoryChip merchantId="planet_fitness" />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground flex-shrink-0">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Subtitle */}
      <div className="px-4 py-2 border-b border-border bg-[var(--surface)] flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          {caseData.plan}
        </span>
        <span className="text-[12px] text-muted-foreground">
          ${caseData.monthly_cost.toFixed(2)}/month
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4 flex-1">
        {error && <p className="text-[13px] text-destructive">{error}</p>}

        {canStart && (
          <button
            onClick={handleStartCall}
            className="w-full py-2.5 rounded-md text-[14px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {isCompleted ? "Call Again" : "Approve & Call"}
          </button>
        )}

        {(isLive || isCompleted || turns.length > 0) && (
          <TranscriptView turns={turns} isLive={isLive} />
        )}
      </div>

      {/* Completion footer */}
      {isCompleted && (
        <div className="px-4 py-3 border-t border-border bg-accent/5 flex items-center justify-between gap-3">
          {duration !== null ? (
            <span className="text-[12px] text-muted-foreground font-mono">
              {Math.floor(duration / 60)}m {duration % 60}s
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium bg-accent/10 text-accent">
            <span>✓ Cancellation Confirmed</span>
            {confirmationNumber && (
              <>
                <span className="text-accent/60">·</span>
                <span className="font-mono">{confirmationNumber}</span>
              </>
            )}
          </span>
        </div>
      )}

      {/* Honesty footer */}
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground bg-[var(--surface)]">
        Real call placed via AgentPhone. Live transcript streamed via SSE.
      </div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function StatusPill({ status }: { status: CallStatus }) {
  const config: Record<CallStatus, { label: string; className: string }> = {
    idle: {
      label: "ready",
      className: "bg-[var(--surface-elevated)] text-muted-foreground",
    },
    starting: {
      label: "starting",
      className: "bg-amber-500/10 text-amber-500",
    },
    ringing: {
      label: "ringing",
      className: "bg-amber-500/10 text-amber-500 animate-pulse",
    },
    "in-progress": {
      label: "in progress",
      className: "bg-accent/10 text-accent animate-pulse",
    },
    completed: {
      label: "completed",
      className: "bg-accent/10 text-accent",
    },
    failed: {
      label: "failed",
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
