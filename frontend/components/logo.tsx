/**
 * Logo — the Refund Hunter mark + wordmark.
 *
 * Direction 1 ("The Cut"): a circle severed by a diagonal slash.
 * Inherits color via currentColor so callers can theme via CSS:
 *   <Logo />              mark only
 *   <Logo wordmark />     wordmark on the right
 *   <Logo size={32} />    sized mark only (e.g., hero usage)
 *
 * Geometry comes from design/mark-cut.svg verbatim — see that file for
 * the dasharray math that centers the gaps on the slash crossings.
 *
 * Wordmark layout: viewBox 280×64.
 *   - Mark occupies x=0..40, scale 0.625, centered vertically (y=12..52)
 *   - 12px gap (in viewBox units)
 *   - Text at x=52, font-size 32, centered vertically
 *   - Total content width ~263px; viewBox width 280 leaves a small right margin
 */

interface LogoProps {
  /** Pixel height of the mark/wordmark. Wordmark width is auto-derived. */
  size?: number;
  /** Render "refund hunter" wordmark to the right of the mark. */
  wordmark?: boolean;
  /** Optional className applied to the outer SVG. */
  className?: string;
}

export function Logo({ size = 20, wordmark = false, className }: LogoProps) {
  if (!wordmark) {
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        className={className}
        aria-label="Refund Hunter"
      >
        <circle
          cx="32"
          cy="32"
          r="22"
          strokeWidth="2"
          strokeDasharray="58.6 10.5"
          strokeDashoffset="12.02"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="50.4"
          y1="13.6"
          x2="13.6"
          y2="50.4"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    );
  }

  // Wordmark: mark (40 wide in viewBox) + 12 gap + text (font-size 32).
  // viewBox 280×64 gives a small right margin past the last glyph.
  const VIEWBOX_W = 280;
  const VIEWBOX_H = 64;
  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      height={size}
      width={size * (VIEWBOX_W / VIEWBOX_H)}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Refund Hunter"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        transform="translate(0,12) scale(0.625)"
      >
        <circle
          cx="32"
          cy="32"
          r="22"
          strokeWidth="3.2"
          strokeDasharray="58.6 10.5"
          strokeDashoffset="12.02"
        />
        <line
          x1="50.4"
          y1="13.6"
          x2="13.6"
          y2="50.4"
          strokeWidth="4"
        />
      </g>
      <text
        x="52"
        y="32"
        fill="currentColor"
        fontFamily="Geist, -apple-system, system-ui, sans-serif"
        fontSize="32"
        fontWeight="600"
        letterSpacing="-0.64"
        dominantBaseline="central"
      >
        refund hunter
      </text>
    </svg>
  );
}
