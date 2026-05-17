"use client";

import { Phone, Globe, Mail } from "lucide-react";
import { getGmailAuthUrl } from "@/lib/api";
import { useState } from "react";
import { motion } from "framer-motion";
import { TopNav } from "@/components/top-nav";

export default function Landing() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const authUrl = await getGmailAuthUrl();
      window.location.href = authUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <TopNav />

      {/* Hero — fills the page */}
      <section className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl w-full text-center"
        >
          <h1 className="text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.05] tracking-tight">
            The subscriptions
            <br />
            you can&apos;t cancel.
            <br />
            <span className="text-muted-foreground">We cancel them.</span>
          </h1>

          <p className="text-[15px] md:text-[16px] text-muted-foreground leading-relaxed max-w-md mx-auto mt-8">
            Connect Gmail. Our agents call the phone-gated ones,
            navigate the dark-pattern ones, and email the rest.
          </p>

          <div className="mt-10">
            <button
              onClick={handleConnect}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[15px] font-medium bg-accent text-accent-foreground transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
            >
              <Mail size={16} />
              <span>
                {loading ? "Redirecting to Google..." : "Connect Gmail"}
              </span>
            </button>
            <p className="text-[12px] text-muted-foreground mt-3">
              Read-only · 30 seconds · revoke any time
            </p>
            {error && (
              <p className="text-[12px] text-destructive mt-2">{error}</p>
            )}
          </div>
        </motion.div>
      </section>

      {/* Three-channel context — footnote-sized, below the fold */}
      <section className="px-6 pb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-3xl mx-auto grid grid-cols-3 gap-8 text-center pt-12 border-t border-border"
        >
          <ChannelHint
            icon={Phone}
            label="Phone-gated"
            examples="Planet Fitness, SiriusXM, Comcast"
          />
          <ChannelHint
            icon={Globe}
            label="Dark-pattern"
            examples="Adobe, NYT, Audible"
          />
          <ChannelHint
            icon={Mail}
            label="Email-only"
            examples="LA Fitness, certain ISPs"
          />
        </motion.div>
      </section>

      {/* Minimal copyright — bottom-right */}
      <footer className="px-6 py-4">
        <p className="text-[11px] text-muted-foreground/60 text-right">© 2026</p>
      </footer>
    </main>
  );
}

function ChannelHint({
  icon: Icon,
  label,
  examples,
}: {
  icon: typeof Phone;
  label: string;
  examples: string;
}) {
  return (
    <div className="space-y-1.5">
      <Icon size={14} className="mx-auto text-muted-foreground/70" />
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground/70 leading-snug">
        {examples}
      </p>
    </div>
  );
}
