"use client";

import { Phone, Globe, Mail } from "lucide-react";
import { getGmailAuthUrl } from "@/lib/api";
import { useState } from "react";

export default function Landing() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const authUrl = await getGmailAuthUrl();
      window.location.href = authUrl;
    } catch {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight">
            refund hunter
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            demo mode &middot; v0.2
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="max-w-lg text-center space-y-6">
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight">
            the subscriptions you
            <br />
            can&apos;t cancel.
            <br />
            <span className="text-muted-foreground">we cancel them.</span>
          </h1>

          <p className="text-[15px] text-muted-foreground leading-relaxed max-w-sm mx-auto">
            Connect Gmail and we&apos;ll find every recurring charge, then
            handle the cancellation — phone calls included.
          </p>

          <button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[15px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              "Connecting..."
            ) : (
              <>
                <span>Connect Gmail</span>
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground">
            Read-only &middot; takes 30 seconds
          </p>
        </div>

        {/* Channel row */}
        <div className="mt-16 grid grid-cols-3 gap-12 text-center max-w-md">
          <div className="space-y-2">
            <Phone size={20} className="mx-auto text-muted-foreground" />
            <p className="text-[13px] font-medium">phone-gated</p>
            <p className="text-[12px] text-muted-foreground">
              Gyms, cable, etc.
            </p>
          </div>
          <div className="space-y-2">
            <Globe size={20} className="mx-auto text-muted-foreground" />
            <p className="text-[13px] font-medium">dark-pattern</p>
            <p className="text-[12px] text-muted-foreground">
              Adobe, NYT, etc.
            </p>
          </div>
          <div className="space-y-2">
            <Mail size={20} className="mx-auto text-muted-foreground" />
            <p className="text-[13px] font-medium">email-only</p>
            <p className="text-[12px] text-muted-foreground">Some gyms</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-3">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            Built for Call My Agent &middot; AgentPhone @ YC &middot; May 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
