interface IncompleteBadgeProps {
  missing: string[];
}

// Small, non-blocking hint — never disables or hides anything, just nudges the
// user toward completing optional-but-useful fields.
export default function IncompleteBadge({ missing }: IncompleteBadgeProps) {
  if (missing.length === 0) return null;

  return (
    <span
      title={`Profil incomplet — lipsește: ${missing.join(', ')}`}
      className="inline-flex items-center gap-1.5 text-red-600 text-xs font-medium whitespace-nowrap"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
      Incomplet
    </span>
  );
}
