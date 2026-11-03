/** The app mark: a tiny family tree — one parent, two children — on the brand colour. */
export default function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-brand text-on-brand shadow-sm ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-[62%]"
      >
        <circle cx="12" cy="5.5" r="2.4" />
        <circle cx="5.5" cy="18.5" r="2.4" />
        <circle cx="18.5" cy="18.5" r="2.4" />
        <path d="M12 8v4m0 0H6.5a1 1 0 0 0-1 1v3m6.5-4h5.5a1 1 0 0 1 1 1v3" />
      </svg>
    </span>
  );
}
