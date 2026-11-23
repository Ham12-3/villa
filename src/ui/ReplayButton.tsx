/** Small circular button, bottom right: scrolls back to the start. */
export function ReplayButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="replay" onClick={onClick} aria-label="Replay from the start" title="Replay">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M3.2 9a5.8 5.8 0 1 0 1.9-4.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path d="M5.4 1.6v3.4h3.4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
