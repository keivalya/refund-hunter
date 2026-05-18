"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { ScanAnimation } from "@/components/scan-animation";
import { SubscriptionRow } from "@/components/subscription-row";
import { MerchantInsights } from "@/components/dashboard/merchant-insights";
import { Skeleton } from "@/components/skeleton";
import { AnimatedNumber } from "@/components/animated-number";
import { getSubscriptions } from "@/lib/api";

// Merchants currently wired to real execute lanes.
// Keep in sync with WIRED_ROUTES in subscription-row.tsx.
const ACTIVE_DEMO_CASES = ["sub_planet_fitness", "sub_nyt", "sub_la_fitness"];

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

function DashboardContent() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected") === "true";

  const [scanning, setScanning] = useState(justConnected);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [totalRecoverable, setTotalRecoverable] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisabled, setShowDisabled] = useState(true);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const data = await getSubscriptions();
      setSubscriptions(data.subscriptions);
      setTotalRecoverable(data.total_annual_recoverable);
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  if (error === "Gmail not connected") {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-sm">
            <p className="text-[15px] font-semibold">Gmail not connected</p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              We need read-only Gmail access to find your subscriptions.
              Your inbox is never stored — only the cancellation candidates
              we find.
            </p>
            <Link
              href="/"
              className="inline-flex px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90"
            >
              Go back & connect Gmail
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Split into supported vs disabled
  const supported = subscriptions.filter((s) => ACTIVE_DEMO_CASES.includes(s.id));
  const disabled = subscriptions.filter((s) => !ACTIVE_DEMO_CASES.includes(s.id));
  const channelCount = new Set(subscriptions.map((s) => s.channel)).size;

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <div className="flex-1 px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          {/* Scan animation */}
          {scanning && <ScanAnimation onComplete={() => setScanning(false)} />}

          {/* Loading skeleton */}
          {!scanning && !loaded && !error && <DashboardSkeleton />}

          {/* Generic error state */}
          {!scanning && error && error !== "Gmail not connected" && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <p className="text-[14px] font-semibold">Something went wrong</p>
              <p className="text-[13px] text-muted-foreground max-w-md text-center">
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  fetchSubscriptions();
                }}
                className="px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90"
              >
                Retry
              </button>
            </div>
          )}

          {/* Main content */}
          {!scanning && loaded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-16"
            >
              {/* HERO — recoverable + CTA */}
              <section>
                <SectionHeader>Recoverable</SectionHeader>
                <div className="flex items-end justify-between gap-6 flex-wrap mt-4">
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-muted-foreground text-3xl font-semibold">$</span>
                      <span className="text-[56px] font-semibold tracking-tight tabular-nums leading-none">
                        <AnimatedNumber value={totalRecoverable} />
                      </span>
                      <span className="text-[15px] text-muted-foreground ml-2">
                        per year
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground mt-3">
                      Across {subscriptions.length} subscriptions and {channelCount} channels.
                    </p>
                  </div>

                  {supported.length > 0 && (
                    <Link
                      href={`/execute?cases=${ACTIVE_DEMO_CASES.join(",")}`}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-md text-[15px] font-semibold bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
                    >
                      Approve all {supported.length}
                    </Link>
                  )}
                </div>
              </section>

              {/* SUPPORTED MERCHANTS */}
              {supported.length > 0 && (
                <section>
                  <SectionHeader>Subscriptions</SectionHeader>
                  <div className="border border-border rounded-lg overflow-hidden mt-4">
                    {supported.map((sub, i) => (
                      <motion.div
                        key={sub.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.25,
                          delay: i * 0.04,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <SubscriptionRow sub={sub} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* DISABLED — collapsed by default */}
              {disabled.length > 0 && (
                <section>
                  <button
                    onClick={() => setShowDisabled((v) => !v)}
                    className="flex items-center gap-2 text-[12px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    aria-expanded={showDisabled}
                  >
                    <span>
                      Also detected · {disabled.length} more
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${
                        showDisabled ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {showDisabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="border border-border rounded-lg overflow-hidden mt-4"
                    >
                      {disabled.map((sub) => (
                        <SubscriptionRow key={sub.id} sub={sub} disabled />
                      ))}
                    </motion.div>
                  )}
                  {!showDisabled && (
                    <p className="text-[12px] text-muted-foreground mt-2">
                      Adobe Creative Cloud, SiriusXM, and Audible — support
                      shipping in the next release.
                    </p>
                  )}
                </section>
              )}

              {/* INTELLIGENCE */}
              <section>
                <SectionHeader>Intelligence</SectionHeader>
                <div className="mt-4">
                  <MerchantInsights />
                </div>
              </section>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h2>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-16">
      <section>
        <Skeleton className="h-3 w-24 mb-4" />
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="space-y-3">
            <Skeleton className="h-14 w-72" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-12 w-40" />
        </div>
      </section>
      <section>
        <Skeleton className="h-3 w-32 mb-4" />
        <div className="border border-border rounded-lg overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0"
            >
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col">
          <TopNav />
          <div className="flex-1 px-6 pb-16">
            <div className="max-w-3xl mx-auto">
              <DashboardSkeleton />
            </div>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
