"use client";

import { Phone, Globe, Mail } from "lucide-react";
import Link from "next/link";
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

// Merchants whose buttons are wired to real execute lanes.
const WIRED_ROUTES: Record<string, string> = {
  sub_planet_fitness: "/execute/sub_planet_fitness",
  sub_nyt: "/execute?cases=sub_nyt",
  sub_la_fitness: "/execute?cases=sub_la_fitness",
};

function formatLastCharge(daysAgo: number): string {
  if (daysAgo < 7) return `${daysAgo}d ago`;
  if (daysAgo < 60) return `${Math.round(daysAgo / 7)}w ago`;
  return `${Math.round(daysAgo / 30)}mo ago`;
}

const ACTION_LABELS: Record<string, string> = {
  phone: "Approve & Call",
  browser: "Approve & Run",
  email: "Approve & Send",
};

interface SubscriptionRowProps {
  sub: Subscription;
  disabled?: boolean;
}

/**
 * Subscription row — one per merchant.
 * When wired: action button uses Next/Link so cmd+click + right-click follow
 * browser-native behavior (open in new tab, copy link, etc.).
 * When disabled: row renders muted, button is omitted (not replaced with
 * a fake button — real products don't show non-functional affordances).
 */
export function SubscriptionRow({ sub, disabled = false }: SubscriptionRowProps) {
  const Icon = CHANNEL_ICONS[sub.channel] || Globe;
  const wiredRoute = WIRED_ROUTES[sub.id];
  const isWired = Boolean(wiredRoute) && !disabled;
  const actionLabel = ACTION_LABELS[sub.channel] || "Approve";

  return (
    <div
      className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0 transition-colors duration-150 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-[var(--surface-elevated)]"
      }`}
    >
      <Icon size={16} className="flex-shrink-0 text-muted-foreground" />

      <div className="flex-1 min-w-0">
        <p className="text-[16px] font-semibold truncate leading-tight">
          {sub.merchant}
        </p>
        <p className="text-[13px] text-muted-foreground mt-1">
          ${sub.monthly_cost.toFixed(2)}/mo · last charge {formatLastCharge(sub.last_used_days_ago)}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-[20px] font-semibold tabular-nums leading-none">
          ${sub.annual_recoverable.toFixed(2)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">/year</p>
      </div>

      {isWired && wiredRoute && (
        <Link
          href={wiredRoute}
          className="flex-shrink-0 px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
