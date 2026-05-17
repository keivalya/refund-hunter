"use client";

/**
 * MerchantInsights — Supermemory-backed analytics widget.
 *
 * Fetches /api/insights once on mount. Renders one row per demo merchant
 * with channel icon, source count, and either a retention-pattern bar
 * chart (voice) or summary bullets (browser/email).
 */

import { useEffect, useState } from "react";
import { Phone, Globe, Mail, Brain } from "lucide-react";
import { Skeleton } from "@/components/skeleton";
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

  if (error) return null; // fail silently; insights are nice-to-have

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-[var(--surface)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-muted-foreground" />
          <span className="text-[13px] font-semibold">Cancellation intelligence</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          synthesized from prior cancellations
        </span>
      </div>

      {!data && (
        <div className="px-4 py-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2 w-full max-w-md" />
                <Skeleton className="h-2 w-3/4 max-w-md" />
              </div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="divide-y divide-border">
          {MERCHANTS.filter(
            (m) => (data[m.merchant_id]?.call_count ?? 0) > 0
          ).map((m) => (
            <MerchantRow
              key={m.merchant_id}
              config={m}
              playbook={data[m.merchant_id]!}
            />
          ))}
        </div>
      )}
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
  const maxFreq = Math.max(
    1,
    ...playbook.retention_patterns.map((p) => p.freq)
  );

  return (
    <div className="px-5 py-4 flex gap-3">
      <Icon
        size={14}
        className="text-muted-foreground mt-1 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
          <span className="text-[14px] font-semibold">
            {config.display_name}
          </span>
          <span className="text-[12px] text-muted-foreground">
            based on {playbook.call_count} prior {config.channel_label}
          </span>
          {playbook.success_rate > 0 && playbook.call_count >= 3 && (
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {Math.round(playbook.success_rate * 100)}% success
            </span>
          )}
        </div>

        {/* Retention pattern bars (voice merchants) */}
        {playbook.retention_patterns.length > 0 ? (
          <div className="space-y-1.5">
            {playbook.retention_patterns.slice(0, 3).map((p) => (
              <div key={p.offer} className="flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full bg-[var(--surface-elevated)] overflow-hidden">
                  <div
                    className="h-full bg-foreground/30 rounded-full"
                    style={{ width: `${(p.freq / maxFreq) * 100}%` }}
                  />
                </div>
                <span className="text-[12px] text-muted-foreground min-w-[170px] max-w-[220px] truncate">
                  {p.label}
                </span>
                <span className="text-[11px] text-muted-foreground/70 tabular-nums w-10 text-right">
                  {p.freq}/{playbook.call_count}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <SecondaryBullets config={config} playbook={playbook} />
        )}

        {/* Footer stats — quiet metadata, no accent */}
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {playbook.avg_duration_seconds && (
            <span>
              avg {Math.floor(playbook.avg_duration_seconds / 60)}m{" "}
              {playbook.avg_duration_seconds % 60}s
            </span>
          )}
          {playbook.avg_reply_hours != null && (
            <span>typical reply {playbook.avg_reply_hours}h</span>
          )}
          {playbook.confirmation_examples.length > 0 && (
            <span>
              confirmation: {extractFormat(playbook.confirmation_examples[0])}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SecondaryBullets({
  config,
  playbook,
}: {
  config: MerchantConfig;
  playbook: MerchantPlaybook;
}) {
  const bullets: string[] = [];
  if (config.channel === "browser") {
    const handoff = playbook.outcomes["chat_handoff"] || 0;
    const total = playbook.call_count;
    if (total > 0 && handoff > 0) {
      const pct = Math.round((handoff / total) * 100);
      bullets.push(`Gates on chat handoff in ${pct}% of attempts`);
    }
    const selfServe = playbook.outcomes["self_serve_completed"] || 0;
    if (selfServe > 0) {
      const pct = Math.round((selfServe / total) * 100);
      bullets.push(`Self-serve completes ${pct}% of the time`);
    }
  }
  if (config.channel === "email" && playbook.avg_reply_hours != null) {
    bullets.push(
      `Confirmation typically within ${playbook.avg_reply_hours} hours`
    );
  }
  return (
    <ul className="space-y-0.5 text-[12px] text-muted-foreground">
      {bullets.map((b, i) => (
        <li key={i}>• {b}</li>
      ))}
    </ul>
  );
}

function extractFormat(example: string): string {
  const m = example.match(/^([A-Z]+-[A-Z]+)/);
  return `${m?.[1] || example.slice(0, 6)}-XXXXX`;
}
