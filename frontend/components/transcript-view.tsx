"use client";

import { useEffect, useRef } from "react";
import { RetrievalChip } from "./execute/retrieval-chip";
import type { RetrievalEvent } from "@/lib/retrieval-sse";

export interface TranscriptTurn {
  role: "agent" | "user";
  content: string;
  timestamp?: string;
}

interface TranscriptViewProps {
  turns: TranscriptTurn[];
  isLive: boolean;
  /** Tier 2c: map of user-turn-index → retrieval event (1-indexed). */
  retrievalsByUserTurn?: Map<number, RetrievalEvent>;
}

export function TranscriptView({
  turns,
  isLive,
  retrievalsByUserTurn,
}: TranscriptViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-[13px]">
        {isLive ? "Waiting for conversation..." : "No transcript yet"}
      </div>
    );
  }

  // Compute running user-turn index so we can match retrievals.
  let userTurnSeen = 0;

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
      {turns.map((turn, i) => {
        let retrieval: RetrievalEvent | undefined;
        if (turn.role === "user") {
          userTurnSeen += 1;
          retrieval = retrievalsByUserTurn?.get(userTurnSeen);
        }
        return (
          <div key={i}>
            <div
              className={`rounded-md px-4 py-3 text-[14px] leading-relaxed border-l-2 ${
                turn.role === "agent"
                  ? "border-l-accent bg-[var(--surface)]"
                  : "border-l-[var(--ring)] bg-[var(--surface)]"
              }`}
            >
              <span
                className={`text-[11px] font-mono uppercase tracking-wide ${
                  turn.role === "agent" ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {turn.role === "agent" ? "Agent" : "Rep"}
              </span>
              <p className="mt-1">{turn.content}</p>
            </div>
            {retrieval && <RetrievalChip retrieval={retrieval} />}
          </div>
        );
      })}
      {isLive && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          Listening...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
