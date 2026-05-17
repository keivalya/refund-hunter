"use client";

import { use } from "react";
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
        <div className="max-w-2xl mx-auto">
          <CallPanel caseId={caseId} />
        </div>
      </div>
    </div>
  );
}
