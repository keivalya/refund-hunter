"use client";

/**
 * Memory metadata — prose inline element for lane headers.
 *
 * Renders as: "informed by 9 prior calls"
 * Sans-serif, muted, no border, no icon. Pure metadata text.
 */

import { useEffect, useState } from "react";
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
      className="text-[12px] text-muted-foreground"
      title="System prompt enriched with patterns from prior calls via Supermemory."
    >
      informed by {count} prior {count === 1 ? "call" : "calls"}
    </span>
  );
}
