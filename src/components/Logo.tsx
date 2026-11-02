export function LogoCamion({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M6 40V20a3 3 0 0 1 3-3h27a3 3 0 0 1 3 3v20z" fill="#f5b700" />
      <path d="M41 27h10l9 9v4H41z" fill="#fff" />
      <circle cx="20" cy="43" r="6" fill="#1d2327" stroke="#fff" strokeWidth="3.5" />
      <circle cx="49" cy="43" r="6" fill="#1d2327" stroke="#fff" strokeWidth="3.5" />
    </svg>
  );
}
