/**
 * Shimmer skeleton primitive. Used for loading states across the app.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton.Row count={6} />     -- N stacked rows for list loaders
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-[var(--surface-elevated)] ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        style={{ animation: "shimmer 1.6s infinite linear" }}
      />
    </div>
  );
}
