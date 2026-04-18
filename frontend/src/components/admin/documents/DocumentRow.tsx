import type { Document } from '../shared/types';
import { TableCell, TableRow } from '@/components/ui/table';

const STATUS_LABEL: Record<string, string> = {
  active: 'Annotating',
  completed: 'Annotated',
  approved: 'Reviewed',
  rejected: 'Rejected',
};

interface DocumentRowProps {
  readonly document: Document;
  readonly annotatorName?: string;
  readonly onSelect: (document: Document) => void;
  readonly onDelete: (documentId: string) => void;
}

function DocumentRow({ document, annotatorName, onSelect, onDelete }: DocumentRowProps) {
  const statusKey = document.status || 'active';
  const pendingRejected = (document.rejection_count ?? 0) > 0;
  /** Prefer total rejection rows; fall back to rejected-segment count when the list API is older. */
  const commentCount = document.rejection_comment_count ?? document.rejection_count ?? 0;
  /** Orange: no segment still rejected, but there are recorded comments or a checked+resolved rejection. */
  const useOrange =
    !pendingRejected &&
    (commentCount > 0 || document.rejection_resolved === true);
  const badgeClass = pendingRejected
    ? 'bg-red-100 text-red-700 border border-red-200'
    : useOrange
      ? 'bg-orange-100 text-orange-800 border border-orange-200'
      : 'bg-gray-100 text-gray-600 border border-gray-200';
  const iconClass = pendingRejected
    ? 'text-red-400'
    : useOrange
      ? 'text-orange-500'
      : 'text-gray-400';
  const badgeTitle = pendingRejected
    ? 'Segments currently rejected; rejection comments shown'
    : commentCount > 0
      ? 'Rejection comments recorded; no segment is in rejected status now'
      : document.rejection_resolved
        ? 'Reviewer rejection addressed (segment checked, latest rejection resolved)'
        : 'Rejection comments on segments in this document';
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {document.filename || `Document ${document.id.slice(0, 8)}`}
        </div>
        <div className="text-sm text-gray-500">
        {annotatorName}
        </div>
      </TableCell>
      <TableCell className="px-6 py-4 whitespace-nowrap align-middle">
        <div className="flex items-center gap-4">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-semibold rounded-full transition-colors
              ${
                statusKey === 'completed'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : statusKey === 'approved'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : statusKey === 'rejected'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              }
            `}
            title={STATUS_LABEL[statusKey] || statusKey}
          >
            <span className="w-2 h-2 rounded-full mr-2"
              style={{
                background:
                  statusKey === 'completed'
                    ? '#22c55e'
                    : statusKey === 'approved'
                    ? '#3b82f6'
                    : statusKey === 'rejected'
                    ? '#ef4444'
                    : '#facc15',
                display: 'inline-block'
              }}
            ></span>
            {STATUS_LABEL[statusKey] || statusKey}
          </span>
          {commentCount>0&&<span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass}`}
            title={badgeTitle}
          >
            <svg className={`w-3 h-3 shrink-0 ${iconClass}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.257 3.099c.366-.756 1.42-.756 1.786 0l7.451 15.396A1 1 0 0 1 16.584 20H3.416a1 1 0 0 1-.91-1.505L8.257 3.1zM11 14a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm-1-5a1 1 0 0 0-.993.883L9 10v2a1 1 0 0 0 1.993.117L11 12v-2a1 1 0 0 0-1-1z" />
            </svg>
            {commentCount}
          </span>}
        </div>
      </TableCell>
      <TableCell
        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
        title="Checked or approved segments / total segments"
      >
        {(document.checked_segments ?? 0)}/{document.total_segments}
      </TableCell>
     
      <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <button
          onClick={() => onSelect(document)}
          className="text-blue-600 hover:text-blue-900 mr-4"
        >
          View Segments
        </button>
      </TableCell>
    </TableRow>
  );
}

export default DocumentRow;