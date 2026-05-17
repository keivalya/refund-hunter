"use client";

/**
 * Results / celebration screen.
 *
 * Reads lane completion data from sessionStorage (saved by /execute when
 * user clicks "View results"). Falls back to a "nothing to show" state if
 * the user navigates here directly without running an execution.
 */

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Phone,
  Globe,
  Mail,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { AnimatedNumber } from "@/components/animated-number";
import {
  loadCompletions,
  type LaneCompletion,
} from "@/lib/lane-completion";

const ANNUAL_RECOVERABLE: Record<string, number> = {
  sub_planet_fitness: 299.88,
  sub_nyt: 300.0,
  sub_la_fitness: 599.88,
};

const CHANNEL_ICONS = {
  voice: Phone,
  browser: Globe,
  email: Mail,
};

function ResultsContent() {
  const [completions, setCompletions] = useState<LaneCompletion[] | null>(null);

  useEffect(() => {
    setCompletions(loadCompletions());
  }, []);

  // Empty state — direct nav or session cleared
  if (completions !== null && completions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-[15px] font-semibold">No recent runs to show</p>
            <p className="text-[13px] text-muted-foreground">
              Results appear here after you approve cancellations from
              the dashboard.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background"
            >
              Go to dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (completions === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-muted-foreground">Loading results...</p>
        </div>
      </div>
    );
  }

  const successful = completions.filter((c) => c.status === "success");
  const totalSaved = successful.reduce(
    (acc, c) => acc + (ANNUAL_RECOVERABLE[c.caseId] || 0),
    0
  );
  const totalDuration = completions.reduce(
    (acc, c) => acc + (c.durationSeconds || 0),
    0
  );

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to subscriptions</span>
          </Link>

          {/* Celebration headline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="border border-accent/30 rounded-lg px-6 py-6 bg-gradient-to-br from-accent/[0.06] to-transparent"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-[12px] font-mono uppercase tracking-wider text-accent">
                Cancellations confirmed
              </span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-muted-foreground text-3xl font-semibold">$</span>
              <span className="text-5xl font-semibold tracking-tight tabular-nums">
                <AnimatedNumber value={totalSaved} />
              </span>
              <span className="text-[15px] text-muted-foreground">/year saved</span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-2">
              {successful.length} of {completions.length} cancellations
              completed in {formatDuration(totalDuration)}.
            </p>
          </motion.div>

          {/* Per-channel detail cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {completions.map((c, i) => (
              <motion.div
                key={c.caseId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.08 }}
              >
                <DetailCard completion={c} />
              </motion.div>
            ))}
          </div>

          {/* Audit trail summary */}
          <div className="border border-border rounded-lg px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-accent" />
              <span className="text-[13px] font-semibold">Audit trail</span>
              <span className="text-[11px] text-muted-foreground">
                what just happened, in plain English
              </span>
            </div>
            <ul className="space-y-1.5 text-[13px] text-muted-foreground">
              <li>
                • You approved {completions.length} cancellation
                {completions.length === 1 ? "" : "s"} from the dashboard.
              </li>
              <li>
                • Each agent was enriched with the merchant&apos;s
                playbook from Supermemory before starting.
              </li>
              {completions.some((c) => c.channel === "voice") && (
                <li>
                  • Voice agent placed a real call via AgentPhone with
                  in-call retrieval via Moss on each rep turn.
                </li>
              )}
              {completions.some((c) => c.channel === "browser") && (
                <li>
                  • Browser agent navigated the cancellation flow via
                  Browser Use, stopping at the chat-handoff (non-destructive).
                </li>
              )}
              {completions.some((c) => c.channel === "email") && (
                <li>
                  • Email agent sent a templated cancellation request
                  via AgentMail and parsed the confirmation reply.
                </li>
              )}
              <li>
                • Each completion was ingested back into Supermemory so
                future cancellations for these merchants get smarter.
              </li>
            </ul>
          </div>

          {/* Next action */}
          <div className="border border-border rounded-lg px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[14px] font-semibold">
                3 more subscriptions to clean up
              </p>
              <p className="text-[13px] text-muted-foreground">
                Adobe Creative Cloud, SiriusXM, and Audible are
                detected but not wired in this demo.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90"
            >
              Back to dashboard
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailCard({ completion }: { completion: LaneCompletion }) {
  const Icon = CHANNEL_ICONS[completion.channel];
  const isSuccess = completion.status === "success";

  return (
    <div className="border border-border rounded-lg overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-[var(--surface)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className="text-muted-foreground flex-shrink-0" />
          <span className="text-[14px] font-semibold truncate">
            {completion.merchant}
          </span>
        </div>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${
            isSuccess
              ? "bg-accent/10 text-accent"
              : "bg-amber-500/10 text-amber-500"
          }`}
        >
          {isSuccess ? "confirmed" : completion.status}
        </span>
      </div>
      <div className="px-4 py-4 flex-1 space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
            Duration
          </p>
          <p className="text-[14px] font-mono tabular-nums">
            {formatDuration(completion.durationSeconds)}
          </p>
        </div>
        {completion.confirmationNumber && (
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Confirmation #
            </p>
            <p className="text-[14px] font-mono tabular-nums text-accent">
              {completion.confirmationNumber}
            </p>
          </div>
        )}
        {completion.sessionId && (
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Browser session
            </p>
            <p className="text-[12px] font-mono text-muted-foreground truncate">
              {completion.sessionId}
            </p>
          </div>
        )}
        {completion.threadId && (
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Email thread
            </p>
            <p className="text-[12px] font-mono text-muted-foreground truncate">
              {completion.threadId}
            </p>
          </div>
        )}
        {completion.output && completion.channel === "browser" && (
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              Agent report
            </p>
            <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-4">
              {completion.output.slice(0, 240)}
              {completion.output.length > 240 ? "…" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
