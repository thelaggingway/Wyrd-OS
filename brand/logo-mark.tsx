// The brand's mark, pasted by brand/apply.ts in place of upstream's LogoMark in packages/ui/src/components/Logo.tsx.
// Only the part after the marker line is used; it may use what that file imports (cx, SkyPair). Placeholder: a
// rounded square with the name's initial. Swap it for the real logo when it exists.
// --- LogoMark ---
export function LogoMark({
  size,
  className,
  label,
  sky,
}: {
  size?: number;
  className?: string;
  label?: string;
  sky?: SkyPair;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cx("ac-logo__mark", className)}
      style={size ? { width: size, height: size } : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="2" y="2" width="28" height="28" rx="8" fill={sky ? sky[1] : "#4f3dd8"} />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily="'Funnel Display', system-ui, sans-serif"
        fontSize="18"
        fontWeight="600"
        fill="#fff"
      >
        __INITIAL__
      </text>
    </svg>
  );
}
