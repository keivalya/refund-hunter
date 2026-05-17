"use client";

import { Phone, Globe, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Subscription {
  id: string;
  merchant: string;
  plan: string;
  monthly_cost: number;
  annual_recoverable: number;
  channel: string;
  last_used_days_ago: number;
  difficulty: string;
  notes: string;
  phone?: string;
}

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  phone: Phone,
  browser: Globe,
  email: Mail,
};

const DIFFICULTY_LABELS: Record<string, string> = {
  phone_required: "phone required",
  dark_pattern: "dark pattern",
  email_only: "email only",
  easy: "easy",
};

export function SubscriptionRow({ sub }: { sub: Subscription }) {
  const router = useRouter();
  const [toast, setToast] = useState(false);

  const Icon = CHANNEL_ICONS[sub.channel] || Globe;
  const isPlanetFitness = sub.id === "sub_planet_fitness";

  const handleAction = () => {
    if (isPlanetFitness) {
      router.push(`/execute/${sub.id}`);
    } else {
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    }
  };

  const actionLabel =
    sub.channel === "phone" ? "Approve & Call" : "Approve & Run";

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0 group hover:bg-[var(--surface-elevated)] transition-colors">
      {/* Channel icon */}
      <div className="flex-shrink-0">
        <Icon
          size={18}
          className={
            sub.channel === "phone"
              ? "text-foreground"
              : "text-muted-foreground"
          }
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold truncate">
            {sub.merchant}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[13px] text-muted-foreground">
            {sub.plan}
          </span>
          <span className="text-[13px] text-muted-foreground">&middot;</span>
          <span className="text-[13px] text-muted-foreground">
            last used {sub.last_used_days_ago} days ago
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono bg-[var(--surface-elevated)] text-muted-foreground">
            {DIFFICULTY_LABELS[sub.difficulty] || sub.difficulty}
          </span>
          {sub.difficulty === "phone_required" &&
            sub.notes.includes("retention") && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono bg-[var(--surface-elevated)] text-muted-foreground">
                retention script
              </span>
            )}
          {sub.notes.includes("aggressive") && (
            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono bg-amber-500/10 text-amber-500">
              aggressive retention
            </span>
          )}
        </div>
      </div>

      {/* Amount + action */}
      <div className="flex-shrink-0 flex items-center gap-4">
        <div className="text-right">
          <span className="text-[15px] font-semibold">
            ${sub.annual_recoverable.toFixed(2)}
          </span>
          <span className="text-[13px] text-muted-foreground">/yr</span>
        </div>

        <div className="relative">
          <button
            onClick={handleAction}
            className="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors bg-foreground text-background hover:opacity-90"
          >
            {actionLabel}
          </button>

          {toast && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-[var(--surface)] px-3 py-2 text-[12px] text-muted-foreground z-50">
              Voice channel only in this demo — try Planet Fitness.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
