"use client";

/**
 * Tier 2c: retrieval chip rendered beneath a rep transcript turn.
 *
 * Shows the top Moss chunk id + retrieval latency. Tooltip explains
 * "observe mode" honestly: this is Path B, agent's actual response is
 * still produced by AgentPhone's built-in LLM. In production with
 * webhook-mode voice, this hook would shape the response.
 *
 * Fades in on mount, holds, fades out after FADE_AFTER_MS.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import type { RetrievalEvent } from "@/lib/retrieval-sse";

const FADE_AFTER_MS = 12000;

// Human-readable labels for Moss chunk IDs.
// Falls back to the raw id if not mapped.
const CHUNK_LABELS: Record<string, string> = {
  counter_pct_offer: "Decline % discount",
  counter_freeze: "Decline freeze offer",
  counter_personal_training: "Decline free training",
  counter_other_discount: "Decline other discount",
  request_confirmation_number: "Request confirmation #",
  decline_supervisor_transfer: "Decline supervisor transfer",
  decline_callback: "Decline callback",
  decline_let_me_think: "No 'let me think'",
  verify_member_id: "Member ID lookup",
  confirm_billing_cycle: "Confirm billing cycle",
  closing_thank_you: "Closing script",
  do_not_reveal_ai: "Stay human-presenting",
};

interface RetrievalChipProps {
  retrieval: RetrievalEvent;
}

export function RetrievalChip({ retrieval }: RetrievalChipProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), FADE_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const label = CHUNK_LABELS[retrieval.top.id] || retrieval.top.id;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="ml-3 mt-1 inline-flex items-center gap-1.5 rounded border border-border bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
          title={
            `Moss retrieval (observe mode for this demo).\n` +
            `In production with webhook-mode voice this hook would ` +
            `shape the agent's response.\n` +
            `Top chunk: ${retrieval.top.id} (score ${retrieval.top.score.toFixed(2)})`
          }
        >
          <Search size={10} />
          <span>retrieved:</span>
          <span className="text-accent">{label}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>{retrieval.latency_ms}ms</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
