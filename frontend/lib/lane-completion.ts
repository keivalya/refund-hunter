/**
 * Shared shape for a completed lane summary.
 *
 * Each lane (voice/browser/email) calls onComplete() when it reaches a
 * terminal state with this payload. The execute page collects them; the
 * results page reads them back via sessionStorage.
 */

export interface LaneCompletion {
  caseId: string;
  merchant: string;
  channel: "voice" | "browser" | "email";
  status: "success" | "partial" | "timeout" | "failed";
  durationSeconds: number;
  // Channel-specific evidence:
  confirmationNumber?: string | null;   // voice + email
  callId?: string;                       // voice
  threadId?: string;                     // email
  sessionId?: string;                    // browser
  output?: string;                       // browser final report
  completedAt: string;                   // ISO timestamp
}

/** Storage key for sharing completions between /execute and /results. */
const STORAGE_KEY = "refund_hunter_completions";

export function saveCompletions(completions: LaneCompletion[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
  } catch {
    // Storage quota or disabled — fail silently
  }
}

export function loadCompletions(): LaneCompletion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
