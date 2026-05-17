/**
 * Tier 2c: typed parsing for "retrieval" events on the existing call SSE.
 *
 * Backend's /api/calls/{id}/stream emits two kinds of events on the same
 * stream:
 *   - the original transcript events from AgentPhone
 *   - new {"type": "retrieval", ...} events from Moss observation
 *
 * Frontend parses both, displays transcripts as before, and attaches
 * retrieval chips beneath the matching rep turn.
 */

export interface RetrievalEvent {
  type: "retrieval";
  turn_index: number;
  created_at?: string;
  query: string;
  latency_ms: number;
  top: { id: string; score: number; text: string };
  extras?: { id: string; score: number }[];
}

export function isRetrievalEvent(data: unknown): data is RetrievalEvent {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "retrieval"
  );
}
