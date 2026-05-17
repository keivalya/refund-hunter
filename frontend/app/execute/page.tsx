"use client";

/**
 * Multi-lane execute route.
 *
 * URL: /execute?cases=sub_planet_fitness,sub_nyt,sub_la_fitness
 * Renders matching lanes side-by-side. 1 lane = full width, 2+ = grid.
 *
 * Channel routing:
 *   sub_planet_fitness → voice  (CallPanel)
 *   sub_nyt            → browser (BrowserLane)
 *   sub_la_fitness     → email   (EmailLane)
 */

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { CallPanel } from "@/components/call-panel";
import { BrowserLane } from "@/components/execute/browser-lane";
import { EmailLane } from "@/components/execute/email-lane";
import {
  type LaneCompletion,
  saveCompletions,
} from "@/lib/lane-completion";

interface CaseConfig {
  caseId: string;
  channel: "voice" | "browser" | "email";
  merchant: string;
}

const CASE_REGISTRY: Record<string, CaseConfig> = {
  sub_planet_fitness: {
    caseId: "sub_planet_fitness",
    channel: "voice",
    merchant: "Planet Fitness",
  },
  sub_nyt: {
    caseId: "sub_nyt",
    channel: "browser",
    merchant: "New York Times",
  },
  sub_la_fitness: {
    caseId: "sub_la_fitness",
    channel: "email",
    merchant: "LA Fitness",
  },
};

// Annual recoverable amount per merchant (matches subscription seed data).
// Used to compute the "saved" total in the completion banner.
const ANNUAL_RECOVERABLE: Record<string, number> = {
  sub_planet_fitness: 299.88,
  sub_nyt: 300.0,
  sub_la_fitness: 599.88,
};

function MultiExecuteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const casesParam = searchParams.get("cases") || "";
  const caseIds = casesParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const cases = caseIds
    .map((id) => CASE_REGISTRY[id])
    .filter((c): c is CaseConfig => Boolean(c));

  // Track completions across lanes. Keyed by caseId for dedup.
  const [completions, setCompletions] = useState<Map<string, LaneCompletion>>(
    new Map()
  );

  const handleComplete = useCallback((c: LaneCompletion) => {
    setCompletions((prev) => {
      if (prev.has(c.caseId)) return prev;
      const next = new Map(prev);
      next.set(c.caseId, c);
      return next;
    });
  }, []);

  if (cases.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-[15px] font-semibold">No active demos selected</p>
            <p className="text-[13px] text-muted-foreground">
              Go back to the dashboard and approve at least one
              cancellation to start a parallel run.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const gridClass =
    cases.length === 1
      ? "grid grid-cols-1 gap-6 max-w-2xl mx-auto"
      : cases.length === 2
      ? "grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto"
      : "grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto";

  const allDone = completions.size === cases.length && cases.length > 0;
  const totalSaved = Array.from(completions.values()).reduce(
    (acc, c) =>
      c.status === "success" ? acc + (ANNUAL_RECOVERABLE[c.caseId] || 0) : acc,
    0
  );

  const handleViewResults = () => {
    saveCompletions(Array.from(completions.values()));
    router.push(`/results?cases=${caseIds.join(",")}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 px-6 py-8">
        <div className="max-w-7xl mx-auto space-y-5">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to subscriptions</span>
          </Link>

          {/* Progress / completion banner */}
          {cases.length > 1 && (
            <div className="border border-border rounded-lg px-5 py-3 bg-[var(--surface)] flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-[14px] font-semibold">
                  {allDone
                    ? `All ${cases.length} cancellations confirmed`
                    : `Running ${cases.length} cancellations in parallel`}
                </span>
                <span className="text-[12px] font-mono text-muted-foreground tabular-nums">
                  {completions.size}/{cases.length}
                </span>
              </div>
              <AnimatePresence>
                {allDone && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-[13px] text-accent font-semibold">
                      ${totalSaved.toFixed(2)}/yr saved
                    </span>
                    <button
                      onClick={handleViewResults}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                    >
                      <CheckCircle2 size={14} />
                      View results
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className={gridClass}>
            {cases.map((c) => (
              <LaneFor
                key={c.caseId}
                config={c}
                onComplete={handleComplete}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaneFor({
  config,
  onComplete,
}: {
  config: CaseConfig;
  onComplete: (c: LaneCompletion) => void;
}) {
  if (config.channel === "voice") {
    return <CallPanel caseId={config.caseId} onComplete={onComplete} />;
  }
  if (config.channel === "browser") {
    return (
      <BrowserLane
        caseId={config.caseId}
        merchantName={config.merchant}
        onComplete={onComplete}
      />
    );
  }
  if (config.channel === "email") {
    return (
      <EmailLane
        caseId={config.caseId}
        merchantName={config.merchant}
        onComplete={onComplete}
      />
    );
  }
  return null;
}

export default function MultiExecutePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <MultiExecuteContent />
    </Suspense>
  );
}
