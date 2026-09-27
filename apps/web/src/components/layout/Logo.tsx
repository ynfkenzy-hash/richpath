/** Original mark: an upward path inside a rounded badge. */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#111420" />
      <path d="M8 22.5 13.5 15l4.5 4 6-9" stroke="#22C55E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="10" r="2.6" fill="#4ADE80" />
    </svg>
  );
}
