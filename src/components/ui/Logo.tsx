interface LogoProps {
  size?: number
  withText?: boolean
  className?: string
}

/**
 * nyarch logo — a terminal prompt chevron `>_` inside a chip frame.
 * Pure SVG so it scales crisply and animates the cursor blink.
 * Colors are driven by the active theme via CSS variables (so the logo
 * recolors automatically when the theme changes).
 */
export function Logo({ size = 32, withText = true, className = '' }: LogoProps) {
  // Each id is unique per render so multiple logos on a page don't share defs.
  const gid = `logo-g-${size}`
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgb(var(--neon-green))" />
            <stop offset="1" stopColor="rgb(var(--neon-cyan))" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="12"
          fill="rgb(var(--term-950))"
          stroke={`url(#${gid})`}
          strokeWidth="2"
        />
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="12"
          fill="none"
          stroke="rgb(var(--neon-green))"
          strokeWidth="0.5"
          opacity="0.4"
        />
        <path
          d="M16 22 L26 32 L16 42"
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="30"
          y="38"
          width="18"
          height="4"
          rx="1.5"
          fill="rgb(var(--neon-green))"
          className="animate-blink"
        />
      </svg>
      {withText && (
        <span className="font-mono text-lg font-extrabold tracking-tight text-ink">
          ny<span className="text-neon-green">arch</span>
        </span>
      )}
    </div>
  )
}
