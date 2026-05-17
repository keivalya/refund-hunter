"use client";

/**
 * EmailLane — real AgentMail send/receive integration.
 *
 * DEMO NOTE: This lane uses real AgentMail send/receive. The "merchant"
 * inbox (lafitness-demo-keivalya@agentmail.to) is hosted by us with a
 * scripted auto-responder so the demo runs in ~14 seconds instead of
 * 5 business days. In production, the recipient is the merchant's real
 * support email and the auto-responder file
 * (backend/agents/merchant_inbox.py) gets deleted.
 *
 * Flow:
 *   1. POST /api/email/start  → outbound email sent, returns thread_id
 *   2. Open SSE /api/email/{thread_id}/stream
 *   3. Render events: sent → polling → received → confirmed
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import {
  startEmailThread,
  emailStreamUrl,
  type EmailMessage,
} from "@/lib/email-sse";

type LaneStatus =
  | "idle"
  | "sending"
  | "sent"
  | "received"
  | "confirmed"
  | "timeout"
  | "error";

interface EmailLaneProps {
  caseId: string;
  merchantName: string;
}

export function EmailLane({ caseId, merchantName }: EmailLaneProps) {
  const [status, setStatus] = useState<LaneStatus>("idle");
  const [sentMessage, setSentMessage] = useState<EmailMessage | null>(null);
  const [receivedMessage, setReceivedMessage] = useState<EmailMessage | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pollingElapsed, setPollingElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSentBody, setShowSentBody] = useState(false);
  const [showReceivedBody, setShowReceivedBody] = useState(false);

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
    setSentMessage(null);
    setReceivedMessage(null);
    setConfirmationNumber(null);
    setPollingElapsed(null);
    setShowSentBody(false);
    setShowReceivedBody(false);
    setStatus("sending");
    startedAtRef.current = Date.now();
    setElapsed(0);

    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);

    try {
      const thread = await startEmailThread(caseId);
      setSentMessage(thread.sent);
      setStatus("sent");

      const es = new EventSource(emailStreamUrl(thread.thread_id));
      eventSourceRef.current = es;

      es.onopen = () => console.log("[email-lane] SSE open", thread.thread_id);

      es.onmessage = (event) => {
        console.log("[email-lane] SSE event", event.data);
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "sent":
              if (data.message) setSentMessage(data.message);
              break;
            case "polling":
              setPollingElapsed(data.elapsed_s);
              break;
            case "received":
              setReceivedMessage(data.message);
              setStatus("received");
              setPollingElapsed(null);
              break;
            case "confirmed":
              setConfirmationNumber(data.confirmation_number);
              setStatus("confirmed");
              if (tickerRef.current) {
                clearInterval(tickerRef.current);
                tickerRef.current = null;
              }
              es.close();
              break;
            case "timeout":
              setStatus("timeout");
              if (tickerRef.current) {
                clearInterval(tickerRef.current);
                tickerRef.current = null;
              }
              es.close();
              break;
            case "error":
              setError(data.message || "stream error");
              setStatus("error");
              es.close();
              break;
          }
        } catch {
          // ignore non-JSON
        }
      };

      es.onerror = (err) => {
        console.warn("[email-lane] SSE error (browser auto-reconnect)", err);
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

  const isCompleted = status === "confirmed" || status === "timeout";
  const canStart = status === "idle" || status === "error" || isCompleted;
  const isWaiting = status === "sent";

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-[var(--surface)]">
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-muted-foreground" />
          <span className="text-[14px] font-semibold">{merchantName}</span>
          <StatusPill status={status} />
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Subtitle */}
      <div className="px-4 py-2 border-b border-border bg-[var(--surface)] flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          Email cancellation lane
        </span>
        <span className="text-[12px] text-muted-foreground">
          AgentMail · real send/receive
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3 flex-1">
        {error && <p className="text-[13px] text-destructive">{error}</p>}

        {canStart && (
          <button
            onClick={handleStart}
            className="w-full py-2.5 rounded-md text-[14px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            {isCompleted ? "Run Again" : "Approve & Send"}
          </button>
        )}

        {sentMessage && (
          <MessageCard
            kind="sent"
            message={sentMessage}
            expanded={showSentBody}
            onToggle={() => setShowSentBody((v) => !v)}
          />
        )}

        {isWaiting && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span>
              Awaiting reply
              {pollingElapsed !== null ? ` · ${pollingElapsed}s` : "..."}
            </span>
          </div>
        )}

        {receivedMessage && (
          <MessageCard
            kind="received"
            message={receivedMessage}
            expanded={showReceivedBody}
            onToggle={() => setShowReceivedBody((v) => !v)}
          />
        )}
      </div>

      {/* Completion footer */}
      {isCompleted && (
        <div className="px-4 py-3 border-t border-border bg-accent/5 flex items-center justify-between gap-3">
          <span className="text-[12px] text-muted-foreground font-mono">
            {formatElapsed(elapsed)}
          </span>
          {status === "confirmed" && confirmationNumber ? (
            <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium bg-accent/10 text-accent">
              <span>✓ Cancellation Confirmed</span>
              <span className="text-accent/60">·</span>
              <span className="font-mono">{confirmationNumber}</span>
            </span>
          ) : status === "timeout" ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-500">
              No reply yet — typical merchant response is 5–10 business days
            </span>
          ) : (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium bg-accent/10 text-accent">
              ✓ Reply received
            </span>
          )}
        </div>
      )}

      {/* Honesty footer */}
      <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground bg-[var(--surface)]">
        Real email send/receive via AgentMail. Merchant inbox is self-hosted
        for demo timing — in production this routes to the merchant&apos;s
        actual support email.
      </div>
    </div>
  );
}

function MessageCard({
  kind,
  message,
  expanded,
  onToggle,
}: {
  kind: "sent" | "received";
  message: EmailMessage;
  expanded: boolean;
  onToggle: () => void;
}) {
  const label = kind === "sent" ? "📨 Sent" : "✉️ Received";
  const labelColor = kind === "sent" ? "text-muted-foreground" : "text-accent";
  const subText = kind === "sent" ? `To: ${message.to ?? "—"}` : `From: ${message.from}`;
  return (
    <div className="rounded-md border-l-2 border-l-border bg-[var(--surface)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-[10px] font-mono uppercase tracking-wide ${labelColor}`}>
            {label}
          </div>
          <div className="text-[12px] text-muted-foreground truncate mt-0.5">
            {subText}
          </div>
          <div className="text-[13px] mt-0.5 truncate">
            {message.subject || "(no subject)"}
          </div>
        </div>
        <button
          onClick={onToggle}
          className="flex-shrink-0 inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {expanded && (message.body || message.preview) && (
        <pre className="mt-2 text-[12px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[200px] overflow-y-auto">
          {message.body || message.preview}
        </pre>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: LaneStatus }) {
  const config: Record<LaneStatus, { label: string; className: string }> = {
    idle: {
      label: "ready",
      className: "bg-[var(--surface-elevated)] text-muted-foreground",
    },
    sending: {
      label: "sending",
      className: "bg-amber-500/10 text-amber-500 animate-pulse",
    },
    sent: {
      label: "awaiting reply",
      className: "bg-amber-500/10 text-amber-500 animate-pulse",
    },
    received: {
      label: "reply received",
      className: "bg-accent/10 text-accent",
    },
    confirmed: {
      label: "confirmed",
      className: "bg-accent/10 text-accent",
    },
    timeout: {
      label: "no reply",
      className: "bg-amber-500/10 text-amber-500",
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
