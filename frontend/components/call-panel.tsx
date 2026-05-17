"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TranscriptView, type TranscriptTurn } from "./transcript-view";
import { startCall, getCall, streamTranscriptUrl } from "@/lib/api";

interface CaseData {
  case_id: string;
  merchant: string;
  plan: string;
  monthly_cost: number;
  member_name: string;
  member_id: string;
  home_club: string;
  billing_date: string;
  member_since: string;
}

// Target phone number for demo — the "merchant"
const TARGET_PHONE = "+16179358558";

type CallStatus = "idle" | "starting" | "ringing" | "in-progress" | "completed" | "failed";

export function CallPanel({ caseData }: { caseData: CaseData }) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [callId, setCallId] = useState<string | null>(null);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  const handleStartCall = useCallback(async () => {
    setError(null);
    setTurns([]);
    setDuration(null);
    setStatus("starting");

    try {
      const result = await startCall(TARGET_PHONE);
      setCallId(result.call_id);
      setStatus(result.status === "ringing" ? "ringing" : "in-progress");

      // Start SSE transcript stream
      const es = new EventSource(streamTranscriptUrl(result.call_id));
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.role && data.content) {
            setTurns((prev) => [...prev, { role: data.role, content: data.content }]);
            setStatus("in-progress");
          }

          if (data.status === "ended" || data.status === "completed") {
            setStatus("completed");
            if (data.duration) setDuration(data.duration);
            es.close();
          }
        } catch {
          // Non-JSON data, ignore
        }
      };

      es.onerror = () => {
        // SSE connection closed — might mean call ended. Poll for final state.
        es.close();
        pollForCompletion(result.call_id);
      };

      // Also poll periodically for status updates (SSE may not cover everything)
      pollRef.current = setInterval(() => pollForCompletion(result.call_id), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start call");
      setStatus("failed");
    }
  }, []);

  const pollForCompletion = useCallback(async (id: string) => {
    try {
      const call = await getCall(id);

      if (call.status === "completed") {
        setStatus("completed");
        setDuration(call.durationSeconds);

        // Build transcript from call data if SSE didn't deliver it
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

  const isLive = status === "ringing" || status === "in-progress";
  const isCompleted = status === "completed";
  const canStart = status === "idle" || status === "failed" || status === "completed";

  return (
    <div className="space-y-6">
      {/* Case Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">{caseData.merchant}</CardTitle>
              <CardDescription>{caseData.plan}</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">${caseData.monthly_cost}</p>
              <p className="text-xs text-muted-foreground">/month</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Member:</span>{" "}
              {caseData.member_name}
            </div>
            <div>
              <span className="text-muted-foreground">ID:</span>{" "}
              {caseData.member_id}
            </div>
            <div>
              <span className="text-muted-foreground">Club:</span>{" "}
              {caseData.home_club}
            </div>
            <div>
              <span className="text-muted-foreground">Since:</span>{" "}
              {caseData.member_since}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Control */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cancellation Call</CardTitle>
            <StatusBadge status={status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {canStart && (
            <Button
              onClick={handleStartCall}
              className="w-full"
              size="lg"
            >
              {isCompleted ? "Call Again" : "Approve & Call"}
            </Button>
          )}

          {(isLive || isCompleted || turns.length > 0) && (
            <>
              <Separator />
              <TranscriptView turns={turns} isLive={isLive} />
            </>
          )}

          {isCompleted && duration && (
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
              <span>Duration: {Math.floor(duration / 60)}m {duration % 60}s</span>
              <Badge variant="default" className="bg-green-600 text-white">
                Cancellation Requested
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: CallStatus }) {
  const config: Record<CallStatus, { label: string; className: string }> = {
    idle: { label: "Ready", className: "bg-muted text-muted-foreground" },
    starting: { label: "Starting...", className: "bg-yellow-600 text-white" },
    ringing: { label: "Ringing", className: "bg-yellow-600 text-white animate-pulse" },
    "in-progress": { label: "In Progress", className: "bg-green-600 text-white animate-pulse" },
    completed: { label: "Completed", className: "bg-green-600 text-white" },
    failed: { label: "Failed", className: "bg-destructive text-white" },
  };

  const { label, className } = config[status];
  return <Badge className={className}>{label}</Badge>;
}
