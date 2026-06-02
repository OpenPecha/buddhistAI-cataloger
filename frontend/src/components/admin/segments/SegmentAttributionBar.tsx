import { format } from 'date-fns';
import type { SegmentAttributionUser } from '@/features/outliner/types';

function userInitials(name?: string | null): string {
  const n = name?.trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts.at(-1)?.[0];
    if (a && b) return (a + b).toUpperCase();
  }
  return n.slice(0, 2).toUpperCase();
}

function AttributionChip({
  label,
  user,
  at,
  muted,
}: {
  label: string;
  user?: SegmentAttributionUser | null;
  at?: string | null;
  muted?: boolean;
}) {
  const displayName = user?.name?.trim() || (user ? 'Unknown user' : null);
  const when = at ? format(new Date(at), 'PP') : null;

  if (!displayName && !when) {
    return (
      <span className={`text-xs ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}: —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
        muted
          ? 'border-gray-200 bg-white/60 text-gray-500'
          : 'border-gray-200 bg-white text-gray-700'
      }`}
      title={[label, displayName, when].filter(Boolean).join(' · ')}
    >
      <span className="font-medium text-gray-500 shrink-0">{label}</span>
      {displayName ? (
        <>
          {user?.picture ? (
            <img
              src={user.picture}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-semibold uppercase text-gray-700"
              aria-hidden
            >
              {userInitials(user?.name)}
            </span>
          )}
          <span className="truncate font-medium text-gray-800">{displayName}</span>
        </>
      ) : null}
      {when ? <span className="shrink-0 text-gray-400">· {when}</span> : null}
    </span>
  );
}

export interface SegmentAttributionBarProps {
  annotator?: SegmentAttributionUser | null;
  reviewedBy?: SegmentAttributionUser | null;
  reviewedAt?: string | null;
  updatedAt?: string | null;
  isAnnotated?: boolean;
  canEditReview?: boolean;
}

export function SegmentAttributionBar({
  annotator,
  reviewedBy,
  reviewedAt,
  updatedAt,
  isAnnotated,
  canEditReview = false,
}: SegmentAttributionBarProps) {
  const showAnnotatorTime = isAnnotated && updatedAt;
  return (
    <div className="flex flex-wrap  items-center justify-end gap-2">
      {canEditReview && (
        <AttributionChip
          label="Annotator"
          user={annotator}
          at={showAnnotatorTime ? updatedAt : null}
          muted={!isAnnotated}
        />
      )}
      <AttributionChip label="Reviewer" user={reviewedBy} at={reviewedAt} />
    </div>
  );
}
