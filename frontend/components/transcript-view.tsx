"use client";

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";

export interface TranscriptTurn {
  role: "agent" | "user";
  content: string;
  timestamp?: string;
}

interface TranscriptViewProps {
  turns: TranscriptTurn[];
  isLive: boolean;
}

export function TranscriptView({ turns, isLive }: TranscriptViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length]);

  if (turns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        {isLive ? "Waiting for conversation..." : "No transcript yet"}
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
      {turns.map((turn, i) => (
        <div
          key={i}
          className={`flex gap-3 ${turn.role === "agent" ? "justify-start" : "justify-end"}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
              turn.role === "agent"
                ? "bg-primary/10 text-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant={turn.role === "agent" ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {turn.role === "agent" ? "Agent" : "Rep"}
              </Badge>
            </div>
            <p>{turn.content}</p>
          </div>
        </div>
      ))}
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          Listening...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
