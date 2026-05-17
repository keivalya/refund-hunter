"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { CallPanel } from "@/components/call-panel";

export default function ExecutePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = use(params);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Back to subscriptions</span>
          </Link>
          <CallPanel caseId={caseId} />
        </div>
      </div>
    </div>
  );
}
