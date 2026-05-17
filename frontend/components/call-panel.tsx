"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { TranscriptView, type TranscriptTurn } from "./transcript-view";
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
  const [callId, setCallId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const handleStartCall = useCallback(async () => {
    if (!caseData) return;
    setError(null);
    setTurns([]);
    setDuration(null);
    setStatus("starting");

    try {
      const result = await startCall(caseData.phone);
      setCallId(result.call_id);
      setStatus(result.status === "ringing" ? "ringing" : "in-progress");

      const es = new EventSource(streamTranscriptUrl(result.call_id));
      eventSourceRef.current = es;

      es.onmessage = (event) => {
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
            setStatus("completed");
            if (data.duration) setDuration(data.duration);
            es.close();
          }
        } catch {
          // Non-JSON, ignore
        }
      };

      es.onerror = () => {
        es.close();
        pollForCompletion(result.call_id);
      };

      pollRef.current = setInterval(
        () => pollForCompletion(result.call_id),
        5000
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
      setStatus("failed");
    }
  }, [caseData]);

  const pollForCompletion = useCallback(async (id: string) => {
    try {
      const call = await getCall(id);
      if (call.status === "completed") {
        setStatus("completed");
        setDuration(call.durationSeconds);
        if (call.transcripts && call.transcripts.length > 0) {
          const builtTurns: TranscriptTurn[] = [];
          for (const t of call.transcripts) {
            if (t.response) {
              builtTurns.push({ role: "agent", content: t.response });
            }
            if (t.transcript) {
              builtTurns.push({ role: "user", content: t.transcript });
            }
          }
          setTurns(builtTurns);
        }
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
      } else if (call.status === "ringing") {
        setStatus("ringing");
      } else if (call.status === "in-progress") {
        setStatus("in-progress");
      }
    } catch {
      // Polling error — ignore, will retry
    }
  }, []);

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
    <div className="space-y-6">
      {/* Case header */}
      <div className="border border-border rounded-lg px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{caseData.merchant}</h2>
            <p className="text-[13px] text-muted-foreground">{caseData.plan}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">${caseData.monthly_cost}</p>
            <p className="text-[11px] text-muted-foreground">/month</p>
          </div>
        </div>
      </div>

      {/* Call control */}
      <div className="border border-border rounded-lg px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">Cancellation Call</h3>
          <StatusPill status={status} />
        </div>

        {error && <p className="text-[13px] text-destructive">{error}</p>}

        {canStart && (
          <button
            onClick={handleStartCall}
            className="w-full py-2.5 rounded-md text-[15px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {isCompleted ? "Call Again" : "Approve & Call"}
          </button>
        )}

        {(isLive || isCompleted || turns.length > 0) && (
          <>
            <div className="border-t border-border" />
            <TranscriptView turns={turns} isLive={isLive} />
          </>
        )}

        {isCompleted && duration && (
          <div className="flex items-center justify-between text-[13px] text-muted-foreground pt-2">
            <span>
              Duration: {Math.floor(duration / 60)}m {duration % 60}s
            </span>
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-accent/10 text-accent">
              Cancellation Requested
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: CallStatus }) {
  const config: Record<CallStatus, { label: string; className: string }> = {
    idle: {
      label: "Ready",
      className: "bg-[var(--surface-elevated)] text-muted-foreground",
    },
    starting: {
      label: "Starting...",
      className: "bg-amber-500/10 text-amber-500",
    },
    ringing: {
      label: "Ringing",
      className: "bg-amber-500/10 text-amber-500 animate-pulse",
    },
    "in-progress": {
      label: "In Progress",
      className: "bg-accent/10 text-accent animate-pulse",
    },
    completed: {
      label: "Completed",
      className: "bg-accent/10 text-accent",
    },
    failed: {
      label: "Failed",
      className: "bg-destructive/10 text-destructive",
    },
  };

  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono ${className}`}
    >
      {label}
    </span>
  );
}
