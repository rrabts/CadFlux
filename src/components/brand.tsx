export function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <span className={`brand ${light ? "brand-light" : ""}`} aria-label="CadFlux">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
        <path
          d="M4 6h12v7H4zM18 6h12v7H18zM4 16h12v12H4zM18 16h12v12H18z"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path d="M10 13v3m6 6h2m6-9v3" stroke="currentColor" strokeWidth="1.7" />
      </svg>
      {!compact && (
        <span>
          Cad<span className="brand-flux">Flux</span>
        </span>
      )}
    </span>
  );
}
