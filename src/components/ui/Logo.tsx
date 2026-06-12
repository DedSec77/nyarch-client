interface LogoProps {
  size?: number
  withText?: boolean
  className?: string
}

/**
 * nyarch logo — a terminal prompt chevron `>_` inside a chip frame.
 * Pure SVG so it scales crisply and animates the cursor blink.
 */
export function Logo({ size = 32, withText = true, className = '' }: LogoProps) {
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
          <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00ff9c" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="12" fill="#0b0b0d" stroke="url(#logo-g)" strokeWidth="2" />
        <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="#00ff9c" strokeWidth="0.5" opacity="0.4" />
        <path
          d="M16 22 L26 32 L16 42"
          fill="none"
          stroke="url(#logo-g)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="30" y="38" width="18" height="4" rx="1.5" fill="#00ff9c" className="animate-blink" />
      </svg>
      {withText && (
        <span className="font-mono text-lg font-extrabold tracking-tight text-ink">
          ny<span className="text-neon-green">arch</span>
        </span>
      )}
    </div>
  )
}
