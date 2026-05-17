"use client";

/**
 * Multi-lane execute route.
 *
 * URL: /execute?cases=sub_planet_fitness,sub_nyt
 * Renders matching lanes side-by-side. 1 lane = full width, 2+ = grid.
 *
 * Channel routing:
 *   - sub_planet_fitness → voice lane (CallPanel)
 *   - sub_nyt            → browser lane (BrowserLane)
 *   - others             → not currently wired
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { CallPanel } from "@/components/call-panel";
import { BrowserLane } from "@/components/execute/browser-lane";
import { EmailLane } from "@/components/execute/email-lane";

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

function MultiExecuteContent() {
  const searchParams = useSearchParams();
  const casesParam = searchParams.get("cases") || "";
  const caseIds = casesParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const cases = caseIds
    .map((id) => CASE_REGISTRY[id])
    .filter((c): c is CaseConfig => Boolean(c));

  if (cases.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-[15px] text-muted-foreground">
              No valid cases. Use{" "}
              <code className="font-mono text-[13px] bg-muted px-1.5 py-0.5 rounded">
                ?cases=sub_planet_fitness,sub_nyt
              </code>
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
      : "grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto";

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to subscriptions</span>
          </Link>

          {cases.length > 1 && (
            <div className="text-[13px] text-muted-foreground">
              Running {cases.length} cancellations in parallel
            </div>
          )}

          <div className={gridClass}>
            {cases.map((c) => (
              <LaneFor key={c.caseId} config={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaneFor({ config }: { config: CaseConfig }) {
  if (config.channel === "voice") {
    return <CallPanel caseId={config.caseId} />;
  }
  if (config.channel === "browser") {
    return <BrowserLane caseId={config.caseId} merchantName={config.merchant} />;
  }
  if (config.channel === "email") {
    return <EmailLane caseId={config.caseId} merchantName={config.merchant} />;
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
