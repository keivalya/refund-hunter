"use client";

/**
 * MemoryChip — small "memory-enriched · N prior calls" badge for lane headers.
 *
 * Subtle credibility detail: tells the viewer the system prompt was
 * dynamically enriched by Supermemory. Mounts on each lane (voice/browser/email).
 */

import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { getMerchantInsights } from "@/lib/insights";

interface MemoryChipProps {
  merchantId: string;
}

export function MemoryChip({ merchantId }: MemoryChipProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMerchantInsights(merchantId)
      .then((p) => {
        if (!cancelled) setCount(p.call_count);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [merchantId]);

  if (count === null || count === 0) return null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded border border-border bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
      title="System prompt enriched with patterns from prior calls via Supermemory."
    >
      <Brain size={10} />
      <span>memory · {count} prior</span>
    </span>
  );
}
