"use client";

/**
 * MerchantInsights — dashboard panel above the subscription list.
 *
 * Fetches /api/insights once on mount. Renders one row per demo merchant
 * with channel icon, "based on N prior {channel}" line, and 3-4 pattern
 * bullets. Subtler visual treatment than subscription rows — reads as
 * background context, not primary actions.
 */

import { useEffect, useState } from "react";
import { Phone, Globe, Mail, Brain } from "lucide-react";
import {
  getAllInsights,
  type MerchantPlaybook,
  type InsightsResponse,
} from "@/lib/insights";

interface MerchantConfig {
  merchant_id: string;
  display_name: string;
  channel: "voice" | "browser" | "email";
  channel_label: string;
}

const MERCHANTS: MerchantConfig[] = [
  {
    merchant_id: "planet_fitness",
    display_name: "Planet Fitness",
    channel: "voice",
    channel_label: "cancellation calls",
  },
  {
    merchant_id: "nyt",
    display_name: "New York Times",
    channel: "browser",
    channel_label: "cancellation runs",
  },
  {
    merchant_id: "la_fitness",
    display_name: "LA Fitness",
    channel: "email",
    channel_label: "cancellations",
  },
];

const CHANNEL_ICONS = {
  voice: Phone,
  browser: Globe,
  email: Mail,
};

export function MerchantInsights() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllInsights()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load insights");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return null; // fail silently; insights are nice-to-have
  }

  // Loading skeleton
  if (!data) {
    return (
      <div className="border border-border rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border bg-[var(--surface)] flex items-center gap-2">
          <Brain size={14} className="text-muted-foreground" />
          <span className="text-[13px] font-semibold">Merchant insights</span>
        </div>
        <div className="px-4 py-4 text-[12px] text-muted-foreground">
          Loading patterns from prior cancellations...
        </div>
      </div>
    );
  }

  // Only show merchants that have at least one prior call
  const visibleMerchants = MERCHANTS.filter(
    (m) => (data[m.merchant_id]?.call_count ?? 0) > 0
  );
  if (visibleMerchants.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-border bg-[var(--surface)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-muted-foreground" />
          <span className="text-[13px] font-semibold">Merchant insights</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Supermemory · {visibleMerchants.length} merchants
        </span>
      </div>
      <div className="divide-y divide-border">
        {visibleMerchants.map((m) => (
          <MerchantRow
            key={m.merchant_id}
            config={m}
            playbook={data[m.merchant_id]!}
          />
        ))}
      </div>
    </div>
  );
}

function MerchantRow({
  config,
  playbook,
}: {
  config: MerchantConfig;
  playbook: MerchantPlaybook;
}) {
  const Icon = CHANNEL_ICONS[config.channel];
  const bullets = buildBullets(config, playbook);

  return (
    <div className="px-4 py-3 flex gap-3">
      <Icon size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[14px] font-semibold">{config.display_name}</span>
          <span className="text-[12px] text-muted-foreground">
            based on {playbook.call_count} prior {config.channel_label}
          </span>
        </div>
        <ul className="mt-1.5 space-y-0.5 text-[12px] text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function buildBullets(config: MerchantConfig, p: MerchantPlaybook): string[] {
  const bullets: string[] = [];

  // Top retention pattern
  if (p.retention_patterns.length > 0) {
    const top = p.retention_patterns[0];
    bullets.push(
      `Retention typically offers ${top.label} (${top.freq}/${p.call_count} calls)`
    );
  }

  // Counter strategy
  if (config.channel === "voice" && p.retention_patterns.length > 0) {
    bullets.push("Best counter: decline politely, ask for confirmation #");
  }

  // Outcome stats
  if (config.channel === "browser") {
    const handoff = p.outcomes["chat_handoff"] || 0;
    const total = p.call_count;
    if (total > 0 && handoff > 0) {
      const pct = Math.round((handoff / total) * 100);
      bullets.push(`Cancel flow gates on chat handoff in ${pct}% of attempts`);
    }
  }

  // Duration / reply time
  if (p.avg_duration_seconds) {
    const m = Math.floor(p.avg_duration_seconds / 60);
    const s = p.avg_duration_seconds % 60;
    bullets.push(`Avg call duration: ${m}m ${s}s`);
  }
  if (p.avg_reply_hours !== null && p.avg_reply_hours !== undefined) {
    bullets.push(`Auto-confirmation typically within ${p.avg_reply_hours}h`);
  }

  // Confirmation number format
  if (p.confirmation_examples.length > 0) {
    const example = p.confirmation_examples[0];
    const prefix = example.match(/^([A-Z]+-[A-Z]+)/)?.[1] || example.slice(0, 10);
    bullets.push(`Confirmation format: ${prefix}-XXXXX`);
  }

  // Success rate (only show if non-trivial)
  if (p.call_count >= 3 && p.success_rate > 0) {
    bullets.push(`Success rate: ${Math.round(p.success_rate * 100)}%`);
  }

  return bullets.slice(0, 4);
}
