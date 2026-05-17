"use client";

/**
 * B-M3 standalone test route for BrowserLane.
 *
 * Visit /test-browser to verify the iframe live-view and SSE step stream
 * work in isolation before integrating into the multi-lane execute view.
 */

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { BrowserLane } from "@/components/execute/browser-lane";

export default function TestBrowserPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to subscriptions</span>
          </Link>

          <div className="space-y-1">
            <h1 className="text-xl font-semibold">BrowserLane test</h1>
            <p className="text-[13px] text-muted-foreground">
              Standalone test of the Browser Use iframe + SSE stream. Click
              &quot;Approve &amp; Run&quot; to start a live NYT cancel-flow
              navigation.
            </p>
          </div>

          <BrowserLane caseId="sub_nyt" merchantName="New York Times" />
        </div>
      </div>
    </div>
  );
}
