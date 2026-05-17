"use client";

/**
 * AnimatedNumber — count-up animation for hero numbers.
 *
 * Tweens from 0 to `value` once on mount (or whenever `value` changes).
 * Restrained motion: 800ms, ease-out cubic.
 *
 * Usage:
 *   <AnimatedNumber value={2374.92} decimals={2} />
 */

import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
}

export function AnimatedNumber({
  value,
  duration = 0.8,
  decimals = 2,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <>{display.toFixed(decimals)}</>;
}
