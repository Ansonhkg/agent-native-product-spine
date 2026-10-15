// Visual reference: https://beui.dev/components/motion/loader (Spinner).
// Standalone CSS/SVG adaptation. Requires only the project's existing React.
import type { CSSProperties } from "react";
import "./spinner.css";

export type SpinnerProps = {
  size?: number;
  /** Seconds per complete turn. */
  speed?: number;
  label?: string;
  className?: string;
};

export function Spinner({
  size = 32,
  speed = 1,
  label = "Loading",
  className = "",
}: SpinnerProps) {
  const style = {
    "--ux-spinner-size": `${size}px`,
    "--ux-spinner-speed": `${speed}s`,
  } as CSSProperties;

  return (
    <span className={`ux-spinner ${className}`} style={style} role="status">
      <svg
        className="ux-spinner__graphic"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="16" cy="16" r="14.56" stroke="currentColor"
          strokeWidth="2.88" opacity="0.2" />
        <path d="M16 1.44 A14.56 14.56 0 0 1 30.56 16"
          stroke="currentColor" strokeWidth="2.88" strokeLinecap="round" />
      </svg>
      <span className="ux-spinner__label">{label}</span>
    </span>
  );
}
