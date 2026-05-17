"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/top-nav";
import { ScanAnimation } from "@/components/scan-animation";
import { SubscriptionRow } from "@/components/subscription-row";
import { getSubscriptions } from "@/lib/api";

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

  // If just connected, fetch in background during scan animation
  useEffect(() => {
    if (justConnected) {
      fetchSubscriptions();
    } else {
      // Direct navigation — try to load immediately
      fetchSubscriptions();
    }
  }, [justConnected, fetchSubscriptions]);

  const handleScanComplete = () => {
    setScanning(false);
  };

  if (error === "Gmail not connected") {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Gmail not connected yet.</p>
            <a
              href="/"
              className="inline-flex px-4 py-2 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90"
            >
              Go back &amp; connect
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <div className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Scan animation */}
          {scanning && <ScanAnimation onComplete={handleScanComplete} />}

          {/* Subscription list */}
          {!scanning && loaded && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Header */}
              <div className="mb-6">
                <p className="text-[13px] text-muted-foreground mb-1">
                  Found {subscriptions.length} active subscriptions
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-muted-foreground text-3xl font-semibold">
                    $
                  </span>
                  <span className="text-4xl font-semibold tracking-tight">
                    {totalRecoverable.toFixed(2)}
                  </span>
                  <span className="text-[15px] text-muted-foreground ml-1">
                    recoverable per year
                  </span>
                </div>
              </div>

              {/* List */}
              <div className="border border-border rounded-lg overflow-hidden">
                {subscriptions.map((sub) => (
                  <SubscriptionRow key={sub.id} sub={sub} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Loading state (no scan animation, waiting for data) */}
          {!scanning && !loaded && !error && (
            <div className="flex items-center justify-center py-24">
              <p className="text-[13px] text-muted-foreground">Loading...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[13px] text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
