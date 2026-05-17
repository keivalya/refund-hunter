"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SCAN_LINES = [
  "Connecting to inbox...",
  "Checking emails from 2023...",
  "Checking emails from 2024...",
  "Checking emails from 2025...",
  "Identifying recurring charges...",
  "Found 6 subscriptions",
];

interface ScanAnimationProps {
  onComplete: () => void;
}

export function ScanAnimation({ onComplete }: ScanAnimationProps) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visibleLines < SCAN_LINES.length) {
      const timer = setTimeout(
        () => setVisibleLines((v) => v + 1),
        visibleLines === 0 ? 600 : 1000
      );
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setDone(true);
        onComplete();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [visibleLines, onComplete]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          className="flex flex-col items-center justify-center py-24"
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-lg font-semibold mb-6">
            Scanning your inbox...
          </h2>
          <div className="w-full max-w-sm space-y-2">
            {SCAN_LINES.slice(0, visibleLines).map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className={`text-[13px] font-mono ${
                  i === visibleLines - 1
                    ? "text-foreground"
                    : "text-muted-foreground"
                } ${i === SCAN_LINES.length - 1 ? "text-accent font-semibold" : ""}`}
              >
                {i < visibleLines - 1 || i === SCAN_LINES.length - 1
                  ? "✓"
                  : "›"}{" "}
                {line}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
